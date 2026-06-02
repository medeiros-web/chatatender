-- ============================================================
-- MODULE 11 — Commissions & Goals
-- ============================================================

-- Sales squads (times de vendas)
CREATE TABLE IF NOT EXISTS sales_squads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS squad_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id    uuid NOT NULL REFERENCES sales_squads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'seller' CHECK (role IN ('leader','seller')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);

-- Commission rules per org/product
CREATE TABLE IF NOT EXISTS commission_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE CASCADE,
  name            text NOT NULL,
  rule_type       text NOT NULL CHECK (rule_type IN ('percentage','fixed')),
  base_value      numeric(12,4) NOT NULL,   -- % or R$ depending on rule_type
  min_value       numeric(12,2),            -- minimum commission R$
  max_value       numeric(12,2),            -- maximum commission R$ (cap)
  is_default      boolean NOT NULL DEFAULT false,
  applies_to_role text CHECK (applies_to_role IN ('seller','closer','sdr',null)),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Commissions per deal
CREATE TABLE IF NOT EXISTS commissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id         uuid REFERENCES commission_rules(id) ON DELETE SET NULL,
  deal_id         uuid REFERENCES deals(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  deal_value      numeric(12,2) NOT NULL,
  commission_value numeric(12,2) NOT NULL,
  rule_type       text NOT NULL,
  base_value      numeric(12,4) NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_at         timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Sales goals (per user or per squad)
CREATE TABLE IF NOT EXISTS sales_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  squad_id        uuid REFERENCES sales_squads(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  title           text NOT NULL,
  metric          text NOT NULL DEFAULT 'revenue'
                    CHECK (metric IN ('revenue','deals_count','leads_count')),
  target_value    numeric(14,2) NOT NULL,
  period_type     text NOT NULL DEFAULT 'monthly'
                    CHECK (period_type IN ('daily','weekly','monthly','quarterly','annual','custom')),
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR squad_id IS NOT NULL)
);

-- Lead distribution config per org
CREATE TABLE IF NOT EXISTS distribution_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE CASCADE,
  strategy        text NOT NULL DEFAULT 'round_robin'
                    CHECK (strategy IN ('round_robin','least_busy','performance')),
  is_active       boolean NOT NULL DEFAULT true,
  config          jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, product_id)
);

-- Round-robin state (tracks whose turn it is)
CREATE TABLE IF NOT EXISTS distribution_state (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE CASCADE,
  last_assigned_user uuid REFERENCES profiles(id) ON DELETE SET NULL,
  total_distributed  int NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, product_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE sales_squads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_goals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_state  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage squads"
  ON sales_squads FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "org members manage squad members"
  ON squad_members FOR ALL
  USING (
    squad_id IN (
      SELECT id FROM sales_squads
      WHERE organization_id = get_user_organization(auth.uid())
    )
  )
  WITH CHECK (
    squad_id IN (
      SELECT id FROM sales_squads
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "org members manage commission rules"
  ON commission_rules FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "org members manage commissions"
  ON commissions FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "org members manage goals"
  ON sales_goals FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "org members manage distribution"
  ON distribution_config FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "org members manage distribution state"
  ON distribution_state FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- ── calculate_commission ──────────────────────────────────────────────────────
-- Called on deal close (trigger or manual).
-- Finds the best matching rule and creates a commission row.

CREATE OR REPLACE FUNCTION calculate_commission(
  p_deal_id   uuid,
  p_user_id   uuid,
  p_org_id    uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deal_value  numeric(12,2);
  v_product_id  uuid;
  v_rule        RECORD;
  v_commission  numeric(12,2);
  v_comm_id     uuid;
BEGIN
  -- Get deal value and product
  SELECT value, product_id
    INTO v_deal_value, v_product_id
    FROM deals
   WHERE id = p_deal_id;

  IF v_deal_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find most specific rule: product-specific first, then org default
  SELECT *
    INTO v_rule
    FROM commission_rules
   WHERE organization_id = p_org_id
     AND is_default = false
     AND (product_id = v_product_id OR product_id IS NULL)
   ORDER BY
     CASE WHEN product_id = v_product_id THEN 0 ELSE 1 END,
     created_at DESC
   LIMIT 1;

  -- Fall back to org default
  IF NOT FOUND THEN
    SELECT *
      INTO v_rule
      FROM commission_rules
     WHERE organization_id = p_org_id
       AND is_default = true
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL; -- No rule configured
  END IF;

  -- Calculate raw commission
  IF v_rule.rule_type = 'percentage' THEN
    v_commission := v_deal_value * (v_rule.base_value / 100);
  ELSE
    v_commission := v_rule.base_value;
  END IF;

  -- Apply min/max caps
  IF v_rule.min_value IS NOT NULL THEN
    v_commission := GREATEST(v_commission, v_rule.min_value);
  END IF;
  IF v_rule.max_value IS NOT NULL THEN
    v_commission := LEAST(v_commission, v_rule.max_value);
  END IF;

  -- Round to 2 decimal places
  v_commission := ROUND(v_commission, 2);

  -- Insert commission row (upsert by deal+user to avoid duplicates)
  INSERT INTO commissions (
    organization_id, rule_id, deal_id, user_id, product_id,
    deal_value, commission_value, rule_type, base_value, status
  ) VALUES (
    p_org_id, v_rule.id, p_deal_id, p_user_id, v_product_id,
    v_deal_value, v_commission, v_rule.rule_type, v_rule.base_value, 'pending'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_comm_id;

  RETURN v_comm_id;
END;
$$;

-- ── distribute_lead ───────────────────────────────────────────────────────────
-- Assigns a lead to the next seller based on strategy.
-- Returns the assigned user_id.

CREATE OR REPLACE FUNCTION distribute_lead(
  p_lead_id    uuid,
  p_org_id     uuid,
  p_product_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_strategy      text;
  v_assigned_user uuid;
  v_last_user     uuid;
  v_candidate     RECORD;
BEGIN
  -- Get strategy for this product (or org default)
  SELECT strategy, config
    INTO v_strategy
    FROM distribution_config
   WHERE organization_id = p_org_id
     AND (product_id = p_product_id OR product_id IS NULL)
   ORDER BY CASE WHEN product_id = p_product_id THEN 0 ELSE 1 END
   LIMIT 1;

  IF NOT FOUND THEN
    v_strategy := 'round_robin';
  END IF;

  -- Eligible sellers: active users with 'seller' or 'closer' role in org
  -- (in a real implementation you'd filter by sector/squad too)

  IF v_strategy = 'round_robin' THEN
    -- Get last assigned user
    SELECT last_assigned_user
      INTO v_last_user
      FROM distribution_state
     WHERE organization_id = p_org_id
       AND (product_id = p_product_id OR product_id IS NULL)
     LIMIT 1;

    -- Pick the next seller after last_assigned_user
    SELECT ur.user_id
      INTO v_candidate
      FROM user_roles ur
      JOIN profiles p ON p.id = ur.user_id
     WHERE ur.organization_id = p_org_id
       AND ur.role IN ('seller','closer','admin','manager')
       AND (v_last_user IS NULL OR ur.user_id > v_last_user)
     ORDER BY ur.user_id
     LIMIT 1;

    -- Wrap around if no one after last
    IF NOT FOUND THEN
      SELECT ur.user_id
        INTO v_candidate
        FROM user_roles ur
       WHERE ur.organization_id = p_org_id
         AND ur.role IN ('seller','closer','admin','manager')
       ORDER BY ur.user_id
       LIMIT 1;
    END IF;

    v_assigned_user := v_candidate.user_id;

  ELSIF v_strategy = 'least_busy' THEN
    -- Pick seller with fewest open leads
    SELECT ur.user_id
      INTO v_candidate
      FROM user_roles ur
      LEFT JOIN (
        SELECT assigned_to, COUNT(*) AS open_count
          FROM leads
         WHERE organization_id = p_org_id
           AND status NOT IN ('won','lost')
         GROUP BY assigned_to
      ) lc ON lc.assigned_to = ur.user_id
     WHERE ur.organization_id = p_org_id
       AND ur.role IN ('seller','closer','admin','manager')
     ORDER BY COALESCE(lc.open_count, 0) ASC, ur.user_id
     LIMIT 1;

    v_assigned_user := v_candidate.user_id;

  ELSIF v_strategy = 'performance' THEN
    -- Pick seller with most deals won this month
    SELECT ur.user_id
      INTO v_candidate
      FROM user_roles ur
      LEFT JOIN (
        SELECT d.assigned_to, COUNT(*) AS won_count
          FROM deals d
         WHERE d.organization_id = p_org_id
           AND d.status = 'won'
           AND d.created_at >= date_trunc('month', now())
         GROUP BY d.assigned_to
      ) dw ON dw.assigned_to = ur.user_id
     WHERE ur.organization_id = p_org_id
       AND ur.role IN ('seller','closer','admin','manager')
     ORDER BY COALESCE(dw.won_count, 0) DESC, ur.user_id
     LIMIT 1;

    v_assigned_user := v_candidate.user_id;
  END IF;

  IF v_assigned_user IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assign the lead
  UPDATE leads
     SET assigned_to = v_assigned_user,
         updated_at  = now()
   WHERE id = p_lead_id;

  -- Update distribution state
  INSERT INTO distribution_state (organization_id, product_id, last_assigned_user, total_distributed)
  VALUES (p_org_id, p_product_id, v_assigned_user, 1)
  ON CONFLICT (organization_id, product_id)
  DO UPDATE SET
    last_assigned_user = v_assigned_user,
    total_distributed  = distribution_state.total_distributed + 1,
    updated_at         = now();

  RETURN v_assigned_user;
END;
$$;

-- ── Trigger: auto calculate_commission on deal won ────────────────────────────

CREATE OR REPLACE FUNCTION trigger_commission_on_deal_won()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Fire when deal transitions to 'won'
  IF NEW.status = 'won' AND (OLD.status IS DISTINCT FROM 'won') THEN
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM calculate_commission(NEW.id, NEW.assigned_to, NEW.organization_id);
    END IF;
    -- Also calculate for sdr_id / closer_id if present
    IF NEW.sdr_id IS NOT NULL AND NEW.sdr_id <> NEW.assigned_to THEN
      PERFORM calculate_commission(NEW.id, NEW.sdr_id, NEW.organization_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deal_commission'
  ) THEN
    CREATE TRIGGER trg_deal_commission
      AFTER UPDATE ON deals
      FOR EACH ROW EXECUTE FUNCTION trigger_commission_on_deal_won();
  END IF;
END $$;

-- ── Updated_at triggers ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sales_squads_updated_at') THEN
    CREATE TRIGGER trg_sales_squads_updated_at
      BEFORE UPDATE ON sales_squads
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_commission_rules_updated_at') THEN
    CREATE TRIGGER trg_commission_rules_updated_at
      BEFORE UPDATE ON commission_rules
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_commissions_updated_at') THEN
    CREATE TRIGGER trg_commissions_updated_at
      BEFORE UPDATE ON commissions
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sales_goals_updated_at') THEN
    CREATE TRIGGER trg_sales_goals_updated_at
      BEFORE UPDATE ON sales_goals
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

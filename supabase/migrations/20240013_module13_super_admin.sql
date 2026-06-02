-- ============================================================
-- MODULE 13 — Super Admin Panel
-- ============================================================

-- Plans (subscription tiers)
CREATE TABLE IF NOT EXISTS plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  description      text,
  price_monthly    numeric(10,2) NOT NULL DEFAULT 0,
  price_annual     numeric(10,2) NOT NULL DEFAULT 0,
  max_users        int NOT NULL DEFAULT 5,
  max_agents       int NOT NULL DEFAULT 1,
  max_leads        int NOT NULL DEFAULT 1000,
  max_products     int NOT NULL DEFAULT 10,
  features         jsonb NOT NULL DEFAULT '[]',
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Subscriptions (org → plan)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                 uuid REFERENCES plans(id) ON DELETE SET NULL,
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  trial_ends_at           timestamptz,
  current_period_start    timestamptz NOT NULL DEFAULT now(),
  current_period_end      timestamptz,
  payment_provider        text CHECK (payment_provider IN ('stripe','hotmart','manual',null)),
  payment_subscription_id text,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Platform settings (global — white-label, email, AI config)
CREATE TABLE IF NOT EXISTS platform_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text NOT NULL UNIQUE,
  value          text,
  value_json     jsonb,
  description    text,
  is_secret      boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Releases / Changelog
CREATE TABLE IF NOT EXISTS releases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text NOT NULL,
  title        text NOT NULL,
  description  text,
  type         text NOT NULL DEFAULT 'minor'
                 CHECK (type IN ('major','minor','patch','hotfix')),
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Help / Knowledge base articles
CREATE TABLE IF NOT EXISTS help_articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL DEFAULT 'general',
  title        text NOT NULL,
  slug         text NOT NULL UNIQUE,
  content      text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  view_count   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject         text NOT NULL,
  description     text NOT NULL,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  priority        text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Audit logs (cross-org, super admin visibility)
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action        text NOT NULL,
  resource_type text,
  resource_id   uuid,
  old_data      jsonb,
  new_data      jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- System health checks
CREATE TABLE IF NOT EXISTS system_health_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service     text NOT NULL,
  status      text NOT NULL DEFAULT 'ok'
                CHECK (status IN ('ok','degraded','down')),
  latency_ms  int,
  message     text,
  checked_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_org       ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org     ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created      ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org          ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user         ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_releases_published      ON releases(published_at DESC) WHERE is_published = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Super admin only — all tables accessible only by super_admin role

ALTER TABLE plans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_checks   ENABLE ROW LEVEL SECURITY;

-- Plans: super_admin manage, all authenticated can read active plans
CREATE POLICY "super_admin manages plans"
  ON plans FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "authenticated read active plans"
  ON plans FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Subscriptions: super_admin manages all; org members can read their own
CREATE POLICY "super_admin manages subscriptions"
  ON subscriptions FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "org members read own subscription"
  ON subscriptions FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

-- Platform settings: super_admin only (secrets hidden from non-super)
CREATE POLICY "super_admin manages platform settings"
  ON platform_settings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Releases: super_admin manage; authenticated read published
CREATE POLICY "super_admin manages releases"
  ON releases FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "authenticated read published releases"
  ON releases FOR SELECT
  USING (is_published = true AND auth.uid() IS NOT NULL);

-- Help articles: super_admin manage; authenticated read published
CREATE POLICY "super_admin manages help articles"
  ON help_articles FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "authenticated read published articles"
  ON help_articles FOR SELECT
  USING (is_published = true AND auth.uid() IS NOT NULL);

-- Support tickets: super_admin sees all; users manage own
CREATE POLICY "super_admin manages tickets"
  ON support_tickets FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "users manage own tickets"
  ON support_tickets FOR ALL
  USING (user_id = auth.uid() OR organization_id = get_user_organization(auth.uid()))
  WITH CHECK (user_id = auth.uid());

-- Audit logs: super_admin reads all; org admins read own org
CREATE POLICY "super_admin reads all audit logs"
  ON audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "org admins read own audit logs"
  ON audit_logs FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));

CREATE POLICY "insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- System health: super_admin only
CREATE POLICY "super_admin manages health"
  ON system_health_checks FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- ── Helper function: log_audit ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_audit(
  p_action        text,
  p_resource_type text DEFAULT NULL,
  p_resource_id   uuid DEFAULT NULL,
  p_old_data      jsonb DEFAULT NULL,
  p_new_data      jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, old_data, new_data)
  VALUES (
    get_user_organization(auth.uid()),
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_data,
    p_new_data
  );
END;
$$;

-- ── Seed default plans ────────────────────────────────────────────────────────

INSERT INTO plans (name, slug, description, price_monthly, price_annual, max_users, max_agents, max_leads, max_products, features, sort_order)
VALUES
  ('Starter',  'starter',  'Para pequenas equipes começando.',  97,  970,   3,  1,   500,   5,  '["WhatsApp","CRM","Funis","Forms"]',             1),
  ('Pro',      'pro',      'Para equipes em crescimento.',      297, 2970,  10, 3,  5000,  20,  '["WhatsApp","CRM","Funis","Forms","IA Agentes","Comissões"]', 2),
  ('Business', 'business', 'Para operações escaláveis.',        597, 5970,  30, 10, 50000, 100, '["WhatsApp","CRM","Funis","Forms","IA Agentes","Comissões","White-label","Suporte prioritário"]', 3),
  ('Enterprise','enterprise','Personalizado para grandes times.',0,  0,    999,999,999999,999, '["Tudo incluso","SLA","Implementação dedicada"]', 4)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed default platform settings ───────────────────────────────────────────

INSERT INTO platform_settings (key, value, description) VALUES
  ('platform_name',     'ChatAtender',  'Nome da plataforma'),
  ('platform_url',      '',             'URL pública da plataforma'),
  ('support_email',     '',             'Email de suporte'),
  ('from_email',        '',             'Email remetente'),
  ('from_name',         'ChatAtender',  'Nome do remetente de emails'),
  ('resend_api_key',    '',             'Chave API do Resend'),
  ('openai_api_key',    '',             'Chave API OpenAI (agentes IA)'),
  ('google_client_id',  '',             'Google OAuth Client ID'),
  ('google_client_secret','',           'Google OAuth Client Secret'),
  ('logo_url',          '',             'URL do logo da plataforma'),
  ('favicon_url',       '',             'URL do favicon'),
  ('primary_color',     '#7c3aed',      'Cor primária (hex)'),
  ('allow_signup',      'true',         'Permitir auto-cadastro de novas organizações'),
  ('maintenance_mode',  'false',        'Modo manutenção (bloqueia acesso)')
ON CONFLICT (key) DO NOTHING;

-- ── updated_at triggers ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_plans_updated_at') THEN
    CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
    CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_releases_updated_at') THEN
    CREATE TRIGGER trg_releases_updated_at BEFORE UPDATE ON releases FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_help_articles_updated_at') THEN
    CREATE TRIGGER trg_help_articles_updated_at BEFORE UPDATE ON help_articles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_tickets_updated_at') THEN
    CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

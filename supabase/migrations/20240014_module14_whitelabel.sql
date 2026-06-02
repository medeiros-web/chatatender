-- ============================================================
-- MODULE 14 — White-label
-- ============================================================

-- Add missing platform_settings keys (complement Module 13 seeds)
INSERT INTO platform_settings (key, value, description) VALUES
  ('login_bg_url',       '',                     'URL da imagem de fundo na tela de login'),
  ('primary_color_hsl',  '262.1 83.3% 57.8%',   'Cor primária em HSL (sem "hsl()")'),
  ('terms_url',          '',                     'URL dos Termos de Uso'),
  ('privacy_url',        '',                     'URL da Política de Privacidade'),
  ('app_url',            '',                     'URL pública do app (ex: https://app.chatatender.com)')
ON CONFLICT (key) DO NOTHING;

-- Per-org branding overrides (true white-label)
-- Each org can override the global platform_settings for /wl/:orgSlug
CREATE TABLE IF NOT EXISTS org_branding (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  platform_name       text,
  logo_url            text,
  favicon_url         text,
  login_bg_url        text,
  primary_color_hsl   text,
  support_email       text,
  terms_url           text,
  privacy_url         text,
  custom_domain       text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_branding_org ON org_branding(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_branding_domain ON org_branding(custom_domain) WHERE custom_domain IS NOT NULL;

ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;

-- Super admin manages all org branding
CREATE POLICY "super_admin manages org_branding"
  ON org_branding FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Org admins manage their own branding
CREATE POLICY "org admins manage own branding"
  ON org_branding FOR ALL
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));

-- Public read (for /wl/:orgSlug page — no auth required)
CREATE POLICY "public read org branding"
  ON org_branding FOR SELECT
  USING (is_active = true);

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_org_branding_updated_at') THEN
    CREATE TRIGGER trg_org_branding_updated_at
      BEFORE UPDATE ON org_branding
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- ── Helper: resolve_branding(org_id) ─────────────────────────────────────────
-- Returns merged branding: org overrides take priority over global platform_settings

CREATE OR REPLACE FUNCTION resolve_branding(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_global   jsonb := '{}'::jsonb;
  v_org      jsonb := '{}'::jsonb;
  v_row      RECORD;
BEGIN
  -- Build global settings object
  FOR v_row IN SELECT key, value FROM platform_settings LOOP
    v_global := v_global || jsonb_build_object(v_row.key, v_row.value);
  END LOOP;

  -- Get org overrides
  IF p_org_id IS NOT NULL THEN
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'platform_name',     platform_name,
      'logo_url',          logo_url,
      'favicon_url',       favicon_url,
      'login_bg_url',      login_bg_url,
      'primary_color_hsl', primary_color_hsl,
      'support_email',     support_email,
      'terms_url',         terms_url,
      'privacy_url',       privacy_url,
      'custom_domain',     custom_domain
    )) INTO v_org
    FROM org_branding
    WHERE organization_id = p_org_id AND is_active = true;
  END IF;

  -- Merge: org overrides global
  RETURN v_global || COALESCE(v_org, '{}'::jsonb);
END;
$$;

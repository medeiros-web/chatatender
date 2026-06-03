-- MODULE 1: Auth & Identidade
-- Tabelas base: organizations, profiles, user_roles
-- Trigger: handle_new_user
-- Esta migration documenta o estado inicial do banco.

-- ── organizations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  logo_url   text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "org_members_select" ON organizations
  FOR SELECT USING (
    id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY IF NOT EXISTS "org_admin_update" ON organizations
  FOR UPDATE USING (
    id = get_user_organization(auth.uid())
    AND has_role_or_above(auth.uid(), 'admin'::app_role)
  );

-- ── profiles ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  full_name       text,
  avatar_url      text,
  phone           text,
  job_title       text,
  timezone        text NOT NULL DEFAULT 'America/Sao_Paulo',
  locale          text NOT NULL DEFAULT 'pt-BR',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY IF NOT EXISTS "profiles_select_own_org" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY IF NOT EXISTS "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ── user_roles ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('super_admin', 'admin', 'manager', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            app_role NOT NULL DEFAULT 'seller',
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "user_roles_select" ON user_roles
  FOR SELECT USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY IF NOT EXISTS "user_roles_insert_admin" ON user_roles
  FOR INSERT WITH CHECK (
    has_role_or_above(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY IF NOT EXISTS "user_roles_update_admin" ON user_roles
  FOR UPDATE USING (
    (has_role_or_above(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization(auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY IF NOT EXISTS "user_roles_delete_admin" ON user_roles
  FOR DELETE USING (
    (has_role_or_above(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization(auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ── Funções SECURITY DEFINER ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_organization(p_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION has_role(p_user_id uuid, p_role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role
  );
$$;

CREATE OR REPLACE FUNCTION has_role_or_above(p_user_id uuid, p_min_role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role::text = ANY(
        CASE p_min_role
          WHEN 'seller'      THEN ARRAY['seller','manager','admin','super_admin']
          WHEN 'manager'     THEN ARRAY['manager','admin','super_admin']
          WHEN 'admin'       THEN ARRAY['admin','super_admin']
          WHEN 'super_admin' THEN ARRAY['super_admin']
        END
      )
  );
$$;

-- ── Trigger handle_new_user ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id    uuid;
  v_org_name  text;
  v_org_slug  text;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_org_name := v_full_name || '''s Workspace';
  v_org_slug := lower(regexp_replace(
    regexp_replace(v_org_name, '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )) || '-' || substring(NEW.id::text, 1, 6);

  INSERT INTO public.organizations (name, slug, is_active)
  VALUES (v_org_name, v_org_slug, true)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, organization_id, full_name)
  VALUES (NEW.id, v_org_id, v_full_name)
  ON CONFLICT (id) DO UPDATE SET
    full_name       = EXCLUDED.full_name,
    organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (NEW.id, v_org_id, 'admin')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── platform_settings — seeds globais + RLS aberta para anon ────────────────

ALTER TABLE IF EXISTS platform_settings ENABLE ROW LEVEL SECURITY;

-- Anon pode ler settings globais (necessário para branding na tela de login)
CREATE POLICY IF NOT EXISTS "ps_public_global_read" ON platform_settings
  FOR SELECT USING (organization_id IS NULL);

INSERT INTO platform_settings (organization_id, key, value, is_secret)
VALUES
  (NULL, 'platform_name',    'ChatAtender', false),
  (NULL, 'allow_signup',     'true',        false),
  (NULL, 'maintenance_mode', 'false',       false)
ON CONFLICT DO NOTHING;

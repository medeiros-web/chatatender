-- MODULE 18: User Approval Flow
-- Adds status to profiles, approval tokens, notifica super admin no signup

-- ── 1. email + status em profiles ────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','rejected','suspended'));

-- ── 2. Tabela de tokens de aprovação ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_approval_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  action     text NOT NULL DEFAULT 'approve' CHECK (action IN ('approve','reject')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days',
  used_at    timestamptz
);
ALTER TABLE user_approval_tokens ENABLE ROW LEVEL SECURITY;

-- ── 3. handle_new_user — seta status=pending + notifica ──────────────────────

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

  INSERT INTO public.profiles (id, organization_id, full_name, email, status)
  VALUES (NEW.id, v_org_id, v_full_name, NEW.email, 'pending')
  ON CONFLICT (id) DO UPDATE SET
    full_name       = EXCLUDED.full_name,
    email           = EXCLUDED.email,
    organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (NEW.id, v_org_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Notifica super admin de forma assíncrona
  PERFORM net.http_post(
    url     := 'https://odwrohzvlzlzrkdcwomm.supabase.co/functions/v1/notify-new-signup',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object(
      'user_id',   NEW.id,
      'email',     NEW.email,
      'full_name', v_full_name
    )::text
  );

  RETURN NEW;
END;
$$;

-- Garante que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4. RLS: super_admin pode ver e alterar status de qualquer usuário ────────

CREATE POLICY IF NOT EXISTS "profiles_sa_all" ON profiles
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ── 5. Função helper para o super admin aprovar/rejeitar ─────────────────────

CREATE OR REPLACE FUNCTION set_user_status(p_user_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET status = p_status WHERE id = p_user_id;
END;
$$;

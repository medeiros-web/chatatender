-- ============================================================
-- MODULE 15 — Notificações & Email
-- ============================================================

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL, -- 'lead_created','lead_assigned','message_received','mention','deal_won','goal','system'
  title           text NOT NULL,
  body            text,
  meta            jsonb NOT NULL DEFAULT '{}',
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org     ON notifications(organization_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "org members insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- ── notification_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  channel         text NOT NULL DEFAULT 'in_app', -- 'in_app','email','push'
  status          text NOT NULL DEFAULT 'sent',   -- 'sent','failed','bounced'
  meta            jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read notification_logs" ON notification_logs FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));

-- ── admin_notifications (org-wide banners) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text,
  type            text NOT NULL DEFAULT 'info', -- 'info','warning','success','error'
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read admin_notifications" ON admin_notifications FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) AND is_active = true
         AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "admins manage admin_notifications" ON admin_notifications FOR ALL
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));

-- ── user_notification_settings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_on_lead_assigned   boolean NOT NULL DEFAULT true,
  email_on_message         boolean NOT NULL DEFAULT false,
  email_on_mention         boolean NOT NULL DEFAULT true,
  email_on_deal_won        boolean NOT NULL DEFAULT true,
  sound_enabled            boolean NOT NULL DEFAULT true,
  sound_url                text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own notif settings" ON user_notification_settings FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_notif_settings_updated_at') THEN
    CREATE TRIGGER trg_user_notif_settings_updated_at
      BEFORE UPDATE ON user_notification_settings
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- ── auto_notification_settings (org-level event rules) ────────────────────────
CREATE TABLE IF NOT EXISTS auto_notification_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      text NOT NULL, -- 'lead_created','lead_assigned','message_received','deal_won'
  channel         text NOT NULL DEFAULT 'in_app', -- 'in_app','email'
  template_id     uuid, -- FK added after email_templates
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, event_type, channel)
);

ALTER TABLE auto_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage auto notif" ON auto_notification_settings FOR ALL
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));
CREATE POLICY "members read auto notif" ON auto_notification_settings FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

-- ── email_templates ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  subject         text NOT NULL,
  html_body       text NOT NULL,
  variables       jsonb NOT NULL DEFAULT '[]', -- ["lead.name","deal.value",…]
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage email_templates" ON email_templates FOR ALL
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));
CREATE POLICY "members read email_templates" ON email_templates FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_email_templates_updated_at') THEN
    CREATE TRIGGER trg_email_templates_updated_at
      BEFORE UPDATE ON email_templates
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Add FK from auto_notification_settings → email_templates
ALTER TABLE auto_notification_settings
  ADD CONSTRAINT fk_auto_notif_template
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;

-- ── email_send_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_send_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  template_id     uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  campaign_id     uuid, -- FK added after mass_email_campaigns
  to_email        text NOT NULL,
  to_name         text,
  subject         text NOT NULL,
  html_body       text NOT NULL,
  variables       jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'queued', -- 'queued','sent','failed','bounced'
  resend_id       text,
  error_message   text,
  process_after   timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_queue ON email_send_log(status, process_after) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_email_send_log_org   ON email_send_log(organization_id, created_at DESC);

ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage email_send_log" ON email_send_log FOR ALL
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));

-- ── mass_email_campaigns ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mass_email_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  template_id       uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'draft', -- 'draft','scheduled','sending','sent','cancelled'
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  total_recipients  int NOT NULL DEFAULT 0,
  sent_count        int NOT NULL DEFAULT 0,
  failed_count      int NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mass_campaigns_org ON mass_email_campaigns(organization_id, created_at DESC);

ALTER TABLE mass_email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage campaigns" ON mass_email_campaigns FOR ALL
  USING (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND has_role_or_above(auth.uid(), 'admin'));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mass_campaigns_updated_at') THEN
    CREATE TRIGGER trg_mass_campaigns_updated_at
      BEFORE UPDATE ON mass_email_campaigns
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- ── mass_email_recipients ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mass_email_recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES mass_email_campaigns(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
  email        text NOT NULL,
  name         text,
  status       text NOT NULL DEFAULT 'pending', -- 'pending','sent','failed','bounced','unsubscribed'
  send_log_id  uuid REFERENCES email_send_log(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON mass_email_recipients(campaign_id, status);

ALTER TABLE mass_email_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage recipients" ON mass_email_recipients FOR ALL
  USING (EXISTS (
    SELECT 1 FROM mass_email_campaigns c
    WHERE c.id = campaign_id
      AND c.organization_id = get_user_organization(auth.uid())
      AND has_role_or_above(auth.uid(), 'admin')
  ));

-- Back-fill FK from email_send_log → mass_email_campaigns
ALTER TABLE email_send_log
  ADD CONSTRAINT fk_email_send_log_campaign
  FOREIGN KEY (campaign_id) REFERENCES mass_email_campaigns(id) ON DELETE SET NULL;

-- ── Supabase Realtime for notifications ───────────────────────────────────────
-- Enable realtime publication (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ── Helper functions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_notification(
  p_org_id  uuid,
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text    DEFAULT NULL,
  p_meta    jsonb   DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO notifications (organization_id, user_id, type, title, body, meta)
  VALUES (p_org_id, p_user_id, p_type, p_title, p_body, p_meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION queue_email(
  p_org_id         uuid,
  p_to_email       text,
  p_to_name        text,
  p_subject        text,
  p_html_body      text,
  p_template_id    uuid    DEFAULT NULL,
  p_variables      jsonb   DEFAULT '{}',
  p_delay_seconds  int     DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO email_send_log (
    organization_id, template_id, to_email, to_name,
    subject, html_body, variables, process_after
  )
  VALUES (
    p_org_id, p_template_id, p_to_email, p_to_name,
    p_subject, p_html_body, p_variables,
    now() + (p_delay_seconds || ' seconds')::interval
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── platform_settings seeds ───────────────────────────────────────────────────
INSERT INTO platform_settings (key, value, description) VALUES
  ('resend_api_key',       '', 'Chave API do Resend para envio de e-mails'),
  ('email_from',           '', 'E-mail remetente (ex: noreply@seudominio.com)'),
  ('email_from_name',      '', 'Nome do remetente (ex: ChatAtender)'),
  ('notification_sound_url', '', 'URL do som de notificação (MP3/OGG)')
ON CONFLICT (key) DO NOTHING;

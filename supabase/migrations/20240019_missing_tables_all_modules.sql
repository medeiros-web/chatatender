-- Migration: Create all missing tables for admin and super-admin panels
-- Applied via Supabase MCP on 2026-06-03
-- Covers: Forms, Funnels, Booking, Payments, Commissions, Notifications,
--         Branding, Email Campaigns, Super Admin, Brain/AI

-- PART 1: Forms, Funnels, Booking ---------------------------------

CREATE TABLE IF NOT EXISTS forms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  name            text NOT NULL,
  slug            text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  settings        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY forms_org ON forms USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS form_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  block_type      text NOT NULL,
  label           text NOT NULL,
  description     text,
  placeholder     text,
  required        boolean NOT NULL DEFAULT false,
  options         jsonb,
  settings        jsonb,
  position        integer NOT NULL DEFAULT 0
);
ALTER TABLE form_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_blocks_org ON form_blocks USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS form_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  session_id      text,
  answers         jsonb NOT NULL DEFAULT '{}',
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  referrer        text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_submissions_org ON form_submissions USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS capture_funnels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  name            text NOT NULL,
  slug            text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  start_block_id  text,
  blocks          jsonb NOT NULL DEFAULT '[]',
  settings        jsonb NOT NULL DEFAULT '{}',
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  thumbnail_url   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE capture_funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_funnels_org ON capture_funnels USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS funnel_analytics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id       uuid NOT NULL REFERENCES capture_funnels(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      text,
  event_type      text NOT NULL,
  block_id        text,
  answer_value    text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  referrer        text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE funnel_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY funnel_analytics_org ON funnel_analytics USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS booking_event_types (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                   text NOT NULL,
  slug                   text NOT NULL,
  description            text,
  duration_minutes       integer NOT NULL DEFAULT 30,
  location               text,
  color                  text NOT NULL DEFAULT '#6366f1',
  max_bookings_per_slot  integer NOT NULL DEFAULT 1,
  buffer_before_minutes  integer NOT NULL DEFAULT 0,
  buffer_after_minutes   integer NOT NULL DEFAULT 0,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE booking_event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_event_types_org ON booking_event_types USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS business_hours (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_of_week     integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      time NOT NULL DEFAULT '09:00',
  end_time        time NOT NULL DEFAULT '18:00',
  is_open         boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, day_of_week)
);
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_hours_org ON business_hours USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS business_holidays (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  holiday_date    date NOT NULL,
  name            text NOT NULL,
  is_recurring    boolean NOT NULL DEFAULT false
);
ALTER TABLE business_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY business_holidays_org ON business_holidays USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS availability_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  override_date   date NOT NULL,
  start_time      time,
  end_time        time,
  is_available    boolean NOT NULL DEFAULT false,
  reason          text
);
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY availability_overrides_org ON availability_overrides USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS calendar_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_id         text,
  title               text NOT NULL,
  description         text,
  start_at            timestamptz NOT NULL,
  end_at              timestamptz NOT NULL,
  location            text,
  is_busy             boolean NOT NULL DEFAULT true,
  source              text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','google','booking')),
  booking_request_id  uuid,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY calendar_events_org ON calendar_events USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email    text NOT NULL,
  calendar_id     text NOT NULL,
  access_token    text,
  refresh_token   text,
  token_expiry    timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_calendar_connections_org ON google_calendar_connections USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS booking_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type_id         uuid NOT NULL REFERENCES booking_event_types(id) ON DELETE CASCADE,
  calendar_event_id     uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  lead_id               uuid REFERENCES leads(id) ON DELETE SET NULL,
  requester_name        text NOT NULL,
  requester_email       text NOT NULL,
  requester_phone       text,
  requested_at          timestamptz NOT NULL,
  timezone              text NOT NULL DEFAULT 'America/Sao_Paulo',
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','no_show')),
  notes                 text,
  cancellation_reason   text,
  confirmation_sent_at  timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_requests_org ON booking_requests USING (organization_id = get_user_organization(auth.uid()));

ALTER TABLE calendar_events
  ADD CONSTRAINT fk_calendar_booking FOREIGN KEY (booking_request_id)
    REFERENCES booking_requests(id) ON DELETE SET NULL;

-- PART 2: Payments, Commissions -----------------------------------

CREATE TABLE IF NOT EXISTS payment_integrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('cakto','hotmart','doppus')),
  credentials     jsonb NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, provider)
);
ALTER TABLE payment_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_integrations_org ON payment_integrations USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS payment_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  created_by_user  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_agent uuid,
  provider         text NOT NULL,
  external_id      text,
  title            text NOT NULL,
  url              text NOT NULL,
  amount_cents     integer,
  currency         text NOT NULL DEFAULT 'BRL',
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','paid','cancelled')),
  expires_at       timestamptz,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_links_org ON payment_links USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS payment_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_link_id  uuid REFERENCES payment_links(id) ON DELETE SET NULL,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  provider         text NOT NULL,
  event_type       text NOT NULL,
  external_id      text,
  amount_cents     integer,
  currency         text NOT NULL DEFAULT 'BRL',
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','refunded','chargeback','abandoned')),
  buyer_name       text,
  buyer_email      text,
  buyer_phone      text,
  raw_payload      jsonb NOT NULL DEFAULT '{}',
  processed_at     timestamptz,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_transactions_org ON payment_transactions USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS sales_squads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE sales_squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_squads_org ON sales_squads USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS squad_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id  uuid NOT NULL REFERENCES sales_squads(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'seller' CHECK (role IN ('leader','seller')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (squad_id, user_id)
);
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY squad_members_org ON squad_members
  USING (squad_id IN (
    SELECT id FROM sales_squads WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE TABLE IF NOT EXISTS commission_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  name             text NOT NULL,
  rule_type        text NOT NULL CHECK (rule_type IN ('percentage','fixed')),
  base_value       numeric NOT NULL DEFAULT 0,
  min_value        numeric,
  max_value        numeric,
  is_default       boolean NOT NULL DEFAULT false,
  applies_to_role  text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_rules_org ON commission_rules USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS commissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id          uuid REFERENCES commission_rules(id) ON DELETE SET NULL,
  deal_id          uuid REFERENCES deals(id) ON DELETE SET NULL,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  deal_value       numeric NOT NULL DEFAULT 0,
  commission_value numeric NOT NULL DEFAULT 0,
  rule_type        text NOT NULL,
  base_value       numeric NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_at          timestamptz,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY commissions_org ON commissions USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS sales_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  squad_id        uuid REFERENCES sales_squads(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  title           text NOT NULL,
  metric          text NOT NULL CHECK (metric IN ('revenue','deals_count','leads_count')),
  target_value    numeric NOT NULL DEFAULT 0,
  period_type     text NOT NULL CHECK (period_type IN ('daily','weekly','monthly','quarterly','annual','custom')),
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE sales_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_goals_org ON sales_goals USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS distribution_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE CASCADE,
  strategy        text NOT NULL DEFAULT 'round_robin' CHECK (strategy IN ('round_robin','least_busy','performance')),
  is_active       boolean NOT NULL DEFAULT true,
  config          jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, product_id)
);
ALTER TABLE distribution_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY distribution_config_org ON distribution_config USING (organization_id = get_user_organization(auth.uid()));

-- PART 3: Notifications, Branding, Email -------------------------

CREATE TABLE IF NOT EXISTS org_branding (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  platform_name     text,
  logo_url          text,
  favicon_url       text,
  login_bg_url      text,
  primary_color_hsl text,
  support_email     text,
  terms_url         text,
  privacy_url       text,
  custom_domain     text,
  is_active         boolean NOT NULL DEFAULT true
);
ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_branding_org ON org_branding USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL,
  title           text NOT NULL,
  body            text,
  meta            jsonb NOT NULL DEFAULT '{}',
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own ON notifications USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS user_notification_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_on_lead_assigned  boolean NOT NULL DEFAULT true,
  email_on_message        boolean NOT NULL DEFAULT false,
  email_on_mention        boolean NOT NULL DEFAULT true,
  email_on_deal_won       boolean NOT NULL DEFAULT true,
  sound_enabled           boolean NOT NULL DEFAULT true,
  sound_url               text
);
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_notification_settings_own ON user_notification_settings USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS email_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  subject         text NOT NULL,
  html_body       text NOT NULL,
  variables       jsonb NOT NULL DEFAULT '[]',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_templates_org ON email_templates USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS email_send_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  template_id     uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  campaign_id     uuid,
  to_email        text NOT NULL,
  to_name         text,
  subject         text NOT NULL,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','bounced')),
  resend_id       text,
  error_message   text,
  process_after   timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_send_log_org ON email_send_log
  USING (organization_id IS NULL OR organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS mass_email_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  template_id       uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  total_recipients  integer NOT NULL DEFAULT 0,
  sent_count        integer NOT NULL DEFAULT 0,
  failed_count      integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE mass_email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY mass_email_campaigns_org ON mass_email_campaigns USING (organization_id = get_user_organization(auth.uid()));

ALTER TABLE email_send_log
  ADD CONSTRAINT fk_email_send_campaign FOREIGN KEY (campaign_id)
    REFERENCES mass_email_campaigns(id) ON DELETE SET NULL;

-- PART 4: Super Admin ---------------------------------------------

CREATE TABLE IF NOT EXISTS plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  slug           text NOT NULL UNIQUE,
  description    text,
  price_monthly  numeric NOT NULL DEFAULT 0,
  price_annual   numeric NOT NULL DEFAULT 0,
  max_users      integer NOT NULL DEFAULT 5,
  max_agents     integer NOT NULL DEFAULT 1,
  max_leads      integer NOT NULL DEFAULT 1000,
  max_products   integer NOT NULL DEFAULT 3,
  features       jsonb NOT NULL DEFAULT '[]',
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read ON plans FOR SELECT USING (true);
CREATE POLICY plans_write ON plans FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                  uuid REFERENCES plans(id) ON DELETE SET NULL,
  status                   text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  trial_ends_at            timestamptz,
  current_period_start     timestamptz NOT NULL DEFAULT now(),
  current_period_end       timestamptz,
  payment_provider         text,
  payment_subscription_id  text,
  notes                    text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_org ON subscriptions FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY subscriptions_sa ON subscriptions FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS releases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text NOT NULL UNIQUE,
  title        text NOT NULL,
  description  text,
  type         text NOT NULL DEFAULT 'minor' CHECK (type IN ('major','minor','patch','hotfix')),
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY releases_read ON releases FOR SELECT USING (is_published = true);
CREATE POLICY releases_sa ON releases FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS help_articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL,
  title        text NOT NULL,
  slug         text NOT NULL UNIQUE,
  content      text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  view_count   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_articles_read ON help_articles FOR SELECT USING (is_published = true);
CREATE POLICY help_articles_sa ON help_articles FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject         text NOT NULL,
  description     text NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  priority        text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_tickets_own ON support_tickets FOR SELECT
  USING (user_id = auth.uid() OR organization_id = get_user_organization(auth.uid()));
CREATE POLICY support_tickets_insert ON support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY support_tickets_sa ON support_tickets FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text NOT NULL,
  resource_type   text,
  resource_id     text,
  old_data        jsonb,
  new_data        jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_sa ON audit_logs FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS system_health_checks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service    text NOT NULL,
  status     text NOT NULL CHECK (status IN ('ok','degraded','down')),
  latency_ms integer,
  message    text,
  checked_at timestamptz DEFAULT now()
);
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_health_checks_sa ON system_health_checks FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- PART 5: Brain / AI ----------------------------------------------

CREATE TABLE IF NOT EXISTS product_knowledge_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  type            text NOT NULL CHECK (type IN ('url','pdf','docx','text','sitemap')),
  title           text,
  source_url      text,
  file_path       text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  chunk_count     integer NOT NULL DEFAULT 0,
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE product_knowledge_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_knowledge_sources_org ON product_knowledge_sources
  USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id       uuid REFERENCES product_knowledge_sources(id) ON DELETE CASCADE,
  title           text NOT NULL,
  content         text NOT NULL,
  chunk_index     integer NOT NULL DEFAULT 0,
  token_count     integer,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_knowledge_base_org ON ai_knowledge_base
  USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS agent_training_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES product_agents(id) ON DELETE SET NULL,
  title           text NOT NULL,
  content         text NOT NULL,
  type            text NOT NULL DEFAULT 'text' CHECK (type IN ('text','faq','script','objection')),
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE agent_training_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_training_materials_org ON agent_training_materials
  USING (organization_id = get_user_organization(auth.uid()));

CREATE TABLE IF NOT EXISTS ai_audits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id         uuid REFERENCES product_agents(id) ON DELETE SET NULL,
  conversation_id  uuid REFERENCES webchat_conversations(id) ON DELETE SET NULL,
  input_text       text NOT NULL,
  output_text      text NOT NULL,
  retrieved_chunks jsonb NOT NULL DEFAULT '[]',
  latency_ms       integer,
  token_input      integer,
  token_output     integer,
  score            numeric,
  flagged          boolean NOT NULL DEFAULT false,
  flag_reason      text,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE ai_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_audits_org ON ai_audits
  USING (organization_id = get_user_organization(auth.uid()));

INSERT INTO plans (name, slug, description, price_monthly, price_annual, max_users, max_agents, max_leads, max_products, features, is_active, sort_order)
VALUES
  ('Free', 'free', 'Plano gratuito para começar', 0, 0, 2, 1, 100, 1, '["WhatsApp","CRM básico"]', true, 0),
  ('Pro', 'pro', 'Para times em crescimento', 19700, 15700, 10, 3, 5000, 5, '["WhatsApp","CRM completo","Agentes IA","Formulários","Funis"]', true, 1),
  ('Business', 'business', 'Para empresas estabelecidas', 49700, 39700, 50, 10, 50000, 20, '["Tudo do Pro","API","White-label","Suporte prioritário"]', true, 2)
ON CONFLICT (slug) DO NOTHING;

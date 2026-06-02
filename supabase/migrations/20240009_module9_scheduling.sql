-- ============================================================
-- MODULE 9 — Scheduling / Booking
-- ============================================================

-- Booking event types (link pra agendar com a equipe)
CREATE TABLE IF NOT EXISTS booking_event_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name            text NOT NULL,
  slug            text NOT NULL,
  description     text,
  duration_minutes int NOT NULL DEFAULT 30,
  location        text,                          -- 'google_meet' | 'zoom' | 'phone' | 'in_person' | custom text
  color           text NOT NULL DEFAULT '#6366f1',
  max_bookings_per_slot int DEFAULT 1,
  buffer_before_minutes int DEFAULT 0,
  buffer_after_minutes  int DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Business hours per org (default Mon–Fri 09:00–18:00)
CREATE TABLE IF NOT EXISTS business_hours (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time      time NOT NULL DEFAULT '09:00',
  end_time        time NOT NULL DEFAULT '18:00',
  is_open         boolean NOT NULL DEFAULT true,
  UNIQUE(organization_id, day_of_week)
);

-- Business holidays
CREATE TABLE IF NOT EXISTS business_holidays (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  holiday_date    date NOT NULL,
  name            text NOT NULL,
  is_recurring    boolean NOT NULL DEFAULT false, -- repete todo ano
  UNIQUE(organization_id, holiday_date)
);

-- Date-specific availability overrides
CREATE TABLE IF NOT EXISTS availability_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  override_date   date NOT NULL,
  start_time      time,
  end_time        time,
  is_available    boolean NOT NULL DEFAULT false,
  reason          text,
  UNIQUE(organization_id, override_date)
);

-- Google Calendar OAuth connections
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_email    text NOT NULL,
  calendar_id     text NOT NULL DEFAULT 'primary',
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Calendar events (manual + synced from Google)
CREATE TABLE IF NOT EXISTS calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  external_id     text,                -- Google Calendar event ID
  title           text NOT NULL,
  description     text,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  location        text,
  is_busy         boolean NOT NULL DEFAULT true,
  source          text NOT NULL DEFAULT 'manual', -- 'manual' | 'google' | 'booking'
  booking_request_id uuid,            -- FK added below after booking_requests
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, external_id)
);

-- Booking requests
CREATE TABLE IF NOT EXISTS booking_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type_id   uuid NOT NULL REFERENCES booking_event_types(id) ON DELETE CASCADE,
  calendar_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  requester_name  text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  requested_at    timestamptz NOT NULL,
  timezone        text NOT NULL DEFAULT 'America/Sao_Paulo',
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','no_show')),
  notes           text,
  cancellation_reason text,
  confirmation_sent_at timestamptz,
  reminder_sent_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Add FK from calendar_events to booking_requests (circular, done after both tables exist)
ALTER TABLE calendar_events
  ADD CONSTRAINT fk_calendar_events_booking
  FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id) ON DELETE SET NULL;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE booking_event_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours        ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_holidays     ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests      ENABLE ROW LEVEL SECURITY;

-- booking_event_types: public read for active, org members write
CREATE POLICY "org members read event types"
  ON booking_event_types FOR SELECT
  USING (
    is_active = true OR
    organization_id = get_user_organization(auth.uid())
  );

CREATE POLICY "org members manage event types"
  ON booking_event_types FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- business_hours: public read, org members write
CREATE POLICY "public read business hours"
  ON business_hours FOR SELECT
  USING (true);

CREATE POLICY "org members manage business hours"
  ON business_hours FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- business_holidays: public read, org members write
CREATE POLICY "public read holidays"
  ON business_holidays FOR SELECT
  USING (true);

CREATE POLICY "org members manage holidays"
  ON business_holidays FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- availability_overrides: public read, org members write
CREATE POLICY "public read overrides"
  ON availability_overrides FOR SELECT
  USING (true);

CREATE POLICY "org members manage overrides"
  ON availability_overrides FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- google_calendar_connections: org members only
CREATE POLICY "org members manage google connections"
  ON google_calendar_connections FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- calendar_events: org members read/write; booking inserts allowed via service role
CREATE POLICY "org members manage calendar events"
  ON calendar_events FOR ALL
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- booking_requests: public insert, org members read all
CREATE POLICY "public create booking requests"
  ON booking_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "org members read booking requests"
  ON booking_requests FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "org members update booking requests"
  ON booking_requests FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()))
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- ============================================================
-- Default business hours seed (Mon–Fri 09:00–18:00)
-- for existing orgs — new orgs need trigger or manual setup
-- ============================================================

-- Trigger to seed default business hours on org creation
CREATE OR REPLACE FUNCTION seed_default_business_hours()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO business_hours (organization_id, day_of_week, start_time, end_time, is_open)
  VALUES
    (NEW.id, 0, '09:00', '18:00', false), -- Sun
    (NEW.id, 1, '09:00', '18:00', true),  -- Mon
    (NEW.id, 2, '09:00', '18:00', true),  -- Tue
    (NEW.id, 3, '09:00', '18:00', true),  -- Wed
    (NEW.id, 4, '09:00', '18:00', true),  -- Thu
    (NEW.id, 5, '09:00', '18:00', true),  -- Fri
    (NEW.id, 6, '09:00', '18:00', false)  -- Sat
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_org_created_seed_hours ON organizations;
CREATE TRIGGER on_org_created_seed_hours
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_default_business_hours();

-- Seed existing orgs that have no hours yet
INSERT INTO business_hours (organization_id, day_of_week, start_time, end_time, is_open)
SELECT
  o.id,
  d.day,
  '09:00'::time,
  '18:00'::time,
  d.day NOT IN (0, 6)
FROM organizations o
CROSS JOIN (SELECT generate_series(0, 6) AS day) d
WHERE NOT EXISTS (
  SELECT 1 FROM business_hours bh WHERE bh.organization_id = o.id AND bh.day_of_week = d.day
);

-- ============================================================
-- Updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_event_types_updated_at'
  ) THEN
    CREATE TRIGGER trg_booking_event_types_updated_at
      BEFORE UPDATE ON booking_event_types
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_requests_updated_at'
  ) THEN
    CREATE TRIGGER trg_booking_requests_updated_at
      BEFORE UPDATE ON booking_requests
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

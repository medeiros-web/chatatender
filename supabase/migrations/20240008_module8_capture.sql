-- ============================================================
-- MÓDULO 8 — Captura (Funis & Forms)
-- ============================================================

-- ── capture_funnels ───────────────────────────────────────────
create table if not exists public.capture_funnels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  slug            text not null,
  description     text,
  status          text not null default 'draft' check (status in ('draft','active','archived')),
  start_block_id  text,
  blocks          jsonb not null default '[]',
  settings        jsonb not null default '{}',
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  thumbnail_url   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

alter table public.capture_funnels enable row level security;
create policy "capture_funnels_org" on public.capture_funnels
  using (organization_id = get_user_organization(auth.uid()));
create policy "capture_funnels_public_read" on public.capture_funnels
  for select using (status = 'active');

create trigger capture_funnels_updated_at before update on public.capture_funnels
  for each row execute function update_product_agents_updated_at();

-- ── funnel_analytics ──────────────────────────────────────────
create table if not exists public.funnel_analytics (
  id              uuid primary key default gen_random_uuid(),
  funnel_id       uuid not null references public.capture_funnels(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id      text not null,
  block_id        text,
  event_type      text not null check (event_type in ('view','click','answer','complete','abandon')),
  answer_value    text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  referrer        text,
  fbclid          text,
  gclid           text,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

alter table public.funnel_analytics enable row level security;
create policy "funnel_analytics_org" on public.funnel_analytics
  using (organization_id = get_user_organization(auth.uid()));
create policy "funnel_analytics_insert_public" on public.funnel_analytics
  for insert with check (true);

create index funnel_analytics_funnel_idx on public.funnel_analytics (funnel_id, created_at desc);

-- ── forms ─────────────────────────────────────────────────────
create table if not exists public.forms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  slug            text not null,
  description     text,
  status          text not null default 'draft' check (status in ('draft','active','archived')),
  settings        jsonb not null default '{}',
  -- settings: { redirect_url, submit_message, collect_email, require_phone,
  --             notify_email, bg_color, accent_color, logo_url }
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

alter table public.forms enable row level security;
create policy "forms_org" on public.forms
  using (organization_id = get_user_organization(auth.uid()));
create policy "forms_public_read" on public.forms
  for select using (status = 'active');

-- ── form_blocks ───────────────────────────────────────────────
create table if not exists public.form_blocks (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references public.forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  block_type      text not null check (block_type in (
    'short_text','long_text','email','phone','select',
    'multiselect','date','rating','file','statement','redirect'
  )),
  label           text not null,
  description     text,
  placeholder     text,
  required        boolean not null default false,
  options         jsonb,       -- [{label, value}] para select/multiselect
  settings        jsonb,       -- {max_length, min_rating, max_rating, file_types}
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.form_blocks enable row level security;
create policy "form_blocks_org" on public.form_blocks
  using (organization_id = get_user_organization(auth.uid()));
create policy "form_blocks_public_read" on public.form_blocks
  for select using (true);

-- ── form_submissions ──────────────────────────────────────────
create table if not exists public.form_submissions (
  id              uuid primary key default gen_random_uuid(),
  form_id         uuid not null references public.forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete set null,
  session_id      text,
  answers         jsonb not null default '{}',  -- { block_id: value }
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  referrer        text,
  fbclid          text,
  gclid           text,
  ip_address      text,
  created_at      timestamptz not null default now()
);

alter table public.form_submissions enable row level security;
create policy "form_submissions_org" on public.form_submissions
  using (organization_id = get_user_organization(auth.uid()));
create policy "form_submissions_insert_public" on public.form_submissions
  for insert with check (true);

create index form_submissions_form_idx on public.form_submissions (form_id, created_at desc);

-- ── chat_flows (futuro módulo brain) ──────────────────────────
create table if not exists public.chat_flows (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  funnel_id       uuid references public.capture_funnels(id) on delete cascade,
  name            text not null,
  blocks          jsonb not null default '[]',
  is_active       boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.chat_flows enable row level security;
create policy "chat_flows_org" on public.chat_flows
  using (organization_id = get_user_organization(auth.uid()));

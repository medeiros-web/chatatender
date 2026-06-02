-- ============================================================
-- MÓDULO 7 — IA Agentes Autônomos
-- ============================================================

-- ── product_agents ────────────────────────────────────────────
create table if not exists public.product_agents (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references public.organizations(id) on delete cascade,
  product_id                  uuid not null references public.products(id) on delete cascade,
  name                        text not null default 'Assistente de Vendas',
  avatar_url                  text,
  persona_description         text,
  provider                    text not null default 'anthropic',
  model                       text not null default 'claude-haiku-4-5',
  temperature                 numeric(3,2) not null default 0.7,
  max_tokens                  int not null default 400,
  tone                        text not null default 'professional'
                                check (tone in ('professional','friendly','casual','formal')),
  language                    text not null default 'pt-BR',
  spin_enabled                boolean not null default true,
  proactive_scheduling        boolean not null default true,
  enabled_tools               text[] not null default array[
    'switch_to_agent','criar_nota','registrar_interesse',
    'check_available_slots','schedule_meeting','agendar_followup'
  ],
  system_prompt_extra         text,
  business_context            text,
  objection_handling          text,
  max_messages_before_handoff int not null default 20,
  handoff_triggers            text[],
  is_active                   boolean not null default true,
  is_default                  boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (organization_id, product_id)
);

alter table public.product_agents enable row level security;

create policy "product_agents_org" on public.product_agents
  using (organization_id = get_user_organization(auth.uid()));

-- ── agent_specialists ─────────────────────────────────────────
create table if not exists public.agent_specialists (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id        uuid not null references public.product_agents(id) on delete cascade,
  speciality      text not null,
  keywords        text[] not null default '{}',
  priority        int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.agent_specialists enable row level security;

create policy "agent_specialists_org" on public.agent_specialists
  using (organization_id = get_user_organization(auth.uid()));

-- ── agent_routing_rules ───────────────────────────────────────
create table if not exists public.agent_routing_rules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id        uuid not null references public.product_agents(id) on delete cascade,
  condition_type  text not null check (condition_type in ('keyword','channel','sector','tag','time_of_day','lead_score')),
  condition_value text not null,
  priority        int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.agent_routing_rules enable row level security;

create policy "agent_routing_rules_org" on public.agent_routing_rules
  using (organization_id = get_user_organization(auth.uid()));

-- ── agent_action_logs ─────────────────────────────────────────
create table if not exists public.agent_action_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id        uuid references public.product_agents(id) on delete set null,
  conversation_id uuid references public.webchat_conversations(id) on delete set null,
  lead_id         uuid references public.leads(id) on delete set null,
  action_type     text not null,
  ai_model        text,
  success         boolean not null default true,
  error_message   text,
  cost_usd        numeric(10,6),
  input_tokens    int,
  output_tokens   int,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

alter table public.agent_action_logs enable row level security;

create policy "agent_action_logs_org" on public.agent_action_logs
  using (organization_id = get_user_organization(auth.uid()));

create index agent_action_logs_org_idx on public.agent_action_logs (organization_id, created_at desc);

-- ── agent_handoff_history ─────────────────────────────────────
create table if not exists public.agent_handoff_history (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  conversation_id     uuid references public.webchat_conversations(id) on delete set null,
  from_agent_id       uuid references public.product_agents(id) on delete set null,
  to_user_id          uuid references public.profiles(id) on delete set null,
  reason              text not null default 'trigger'
                        check (reason in ('trigger','keyword','timeout','user_request','limit_reached')),
  trigger_text        text,
  created_at          timestamptz not null default now()
);

alter table public.agent_handoff_history enable row level security;

create policy "agent_handoff_history_org" on public.agent_handoff_history
  using (organization_id = get_user_organization(auth.uid()));

-- ── agent_tool_executions ─────────────────────────────────────
create table if not exists public.agent_tool_executions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.webchat_conversations(id) on delete set null,
  lead_id         uuid references public.leads(id) on delete set null,
  tool_name       text not null,
  tool_input      jsonb,
  tool_output     jsonb,
  success         boolean not null default true,
  error_message   text,
  duration_ms     int,
  created_at      timestamptz not null default now()
);

alter table public.agent_tool_executions enable row level security;

create policy "agent_tool_executions_org" on public.agent_tool_executions
  using (organization_id = get_user_organization(auth.uid()));

create index agent_tool_executions_org_idx on public.agent_tool_executions (organization_id, created_at desc);

-- ── agent_safety_limits ───────────────────────────────────────
create table if not exists public.agent_safety_limits (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null unique references public.organizations(id) on delete cascade,
  max_executions_per_day   int not null default 5000,
  max_cost_usd_per_day     numeric(8,2) not null default 500,
  max_tokens_per_message   int not null default 2000,
  max_tool_calls_per_conv  int not null default 20,
  current_day_executions   int not null default 0,
  current_day_cost_usd     numeric(10,6) not null default 0,
  last_reset_at            timestamptz not null default now(),
  is_paused                boolean not null default false,
  pause_reason             text,
  created_at               timestamptz not null default now()
);

alter table public.agent_safety_limits enable row level security;

create policy "agent_safety_limits_org" on public.agent_safety_limits
  using (organization_id = get_user_organization(auth.uid()));

-- ── org_ai_credentials ───────────────────────────────────────
create table if not exists public.org_ai_credentials (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider        text not null,
  api_key         text not null,
  api_base_url    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, provider)
);

-- RLS com service role apenas (chaves nunca expostas ao client)
alter table public.org_ai_credentials enable row level security;

create policy "org_ai_credentials_select" on public.org_ai_credentials
  for select using (organization_id = get_user_organization(auth.uid()));

create policy "org_ai_credentials_insert" on public.org_ai_credentials
  for insert with check (organization_id = get_user_organization(auth.uid()));

create policy "org_ai_credentials_update" on public.org_ai_credentials
  for update using (organization_id = get_user_organization(auth.uid()));

-- ── org_ai_routing ────────────────────────────────────────────
create table if not exists public.org_ai_routing (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability      text not null
                    check (capability in ('agent_chat','sales_copilot','audio_transcription','image_vision','embedding','summarization')),
  provider        text not null,
  model           text not null,
  temperature     numeric(3,2) not null default 0.7,
  max_tokens      int not null default 400,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, capability)
);

alter table public.org_ai_routing enable row level security;

create policy "org_ai_routing_org" on public.org_ai_routing
  using (organization_id = get_user_organization(auth.uid()));

-- ── Trigger: updated_at product_agents ───────────────────────
create or replace function update_product_agents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger product_agents_updated_at
  before update on public.product_agents
  for each row execute function update_product_agents_updated_at();

-- ── Trigger: init safety_limits ao criar org ─────────────────
create or replace function initialize_agent_safety_limits()
returns trigger language plpgsql security definer as $$
begin
  insert into public.agent_safety_limits (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

create trigger on_org_created_init_safety
  after insert on public.organizations
  for each row execute function initialize_agent_safety_limits();

-- Popula safety_limits para orgs já existentes
insert into public.agent_safety_limits (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

-- ── webchat_conversations: add current_agent_id if missing ───
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'webchat_conversations'
      and column_name = 'current_agent_id'
  ) then
    alter table public.webchat_conversations
      add column current_agent_id uuid references public.product_agents(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'webchat_conversations'
      and column_name = 'whatsapp_instance_id'
  ) then
    alter table public.webchat_conversations
      add column whatsapp_instance_id uuid;
  end if;
end;
$$;

-- ── whatsapp_message_queue (debounce 4s para IA) ─────────────
create table if not exists public.whatsapp_message_queue (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.webchat_conversations(id) on delete cascade,
  process_after   timestamptz not null,
  status          text not null default 'pending'
                    check (status in ('pending','processing','done','failed')),
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Sem RLS — operado apenas pelo service role (edge functions)
alter table public.whatsapp_message_queue enable row level security;

create policy "whatsapp_queue_service_only" on public.whatsapp_message_queue
  using (false);

create index whatsapp_message_queue_pending_idx
  on public.whatsapp_message_queue (process_after)
  where status = 'pending';

-- ── evolution_instances: garantir colunas necessárias ────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'evolution_instances' and column_name = 'product_id'
  ) then
    alter table public.evolution_instances
      add column product_id uuid references public.products(id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'evolution_instances' and column_name = 'instance_name'
  ) then
    alter table public.evolution_instances
      add column instance_name text;
  end if;
end;
$$;

-- ── webchat_conversations: colunas extras ────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'webchat_conversations' and column_name = 'unread_count'
  ) then
    alter table public.webchat_conversations
      add column unread_count int not null default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'webchat_conversations' and column_name = 'last_message_at'
  ) then
    alter table public.webchat_conversations
      add column last_message_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'webchat_conversations' and column_name = 'contact_phone'
  ) then
    alter table public.webchat_conversations
      add column contact_phone text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'webchat_conversations' and column_name = 'contact_external_id'
  ) then
    alter table public.webchat_conversations
      add column contact_external_id text;
  end if;
end;
$$;

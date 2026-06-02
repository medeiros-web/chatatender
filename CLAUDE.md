# ChatAtender — CLAUDE.md

Guia operacional para o Claude Code neste projeto. Leia antes de qualquer ação.

## Identidade do projeto

**ChatAtender** — CRM omnichannel multi-tenant SaaS com agentes de IA autônomos.
Stack: React 18 + Vite + TypeScript + Tailwind v4 + shadcn/ui + TanStack Query v5 + Supabase.

## Estrutura de pastas

```
src/
  components/ui/       # shadcn-style: Button, Input, Card, Dialog, Tabs…
  components/layout/   # AdminSidebar, AdminLayout
  hooks/               # Todos os hooks de data fetching (useAuth, useLeads…)
  pages/admin/         # Páginas do painel admin
  pages/admin/leads/   # LeadDetailModal e sub-componentes
  lib/supabase.ts      # Cliente Supabase tipado
  lib/utils.ts         # cn() helper
  types/database.ts    # Tipos manuais das tabelas
```

## Regras de desenvolvimento

### Design System
- **Nunca** usar cores hardcoded. Sempre `hsl(var(--token))`.
- Tokens definidos em `src/index.css` via `@theme {}` (Tailwind v4).
- `font-sans` (Inter) para body; `font-display` (Plus Jakarta Sans) para títulos.
- Variantes de componentes com `cva()` de `class-variance-authority`.

### Multi-tenant / Supabase
- Toda tabela de domínio: `organization_id uuid NOT NULL` + RLS filtrando por `get_user_organization(auth.uid())`.
- Roles em `user_roles`, **nunca** em `profiles`.
- Queries client sempre com `.eq('organization_id', organizationId)` mesmo com RLS.
- Para operações de escrita com client tipado que retorna `never`, usar `const db = supabase as any`.

### Funções Supabase (SECURITY DEFINER)
- `get_user_organization(user_id)` — retorna org do usuário
- `has_role(user_id, role)` — checa role exato
- `has_role_or_above(user_id, min_role)` — checa hierarquia
- `has_sector_access(user_id, sector_id)` — managers+ sempre têm acesso
- `initialize_user_permissions(user_id, org_id, role)` — padrões por role
- `normalize_phone_br(phone)` — garante DDI 55

### WhatsApp
- DDI `55` obrigatório via `normalize_phone_br()`.
- Debounce 4s: tabela `whatsapp_message_queue`, `process_after = now() + 4s`.
- Chunking: máx 2 partes se > 500 chars, 800ms delay entre partes.
- Atendente único: `assigned_user_id` XOR `current_agent_id` (trigger `enforce_single_attendant`).

### Edge Functions
- Webhooks externos: `verify_jwt = false` em `config.toml` + validação custom.
- Provider detectado por `?provider=evolution_api` ou `?provider=evolution_go` na URL.

## Supabase

- Projeto: `odwrohzvlzlzrkdcwomm` (sa-east-1 — São Paulo)
- URL: `https://odwrohzvlzlzrkdcwomm.supabase.co`
- Credenciais em `.env.local` (não commitar)

## Servidores WhatsApp

Credenciais armazenadas na tabela `evolution_instances` e `platform_settings`.
Ver `/admin/whatsapp` para gerenciar instâncias e status de conexão.

**Webhook Evolution API:**
`https://odwrohzvlzlzrkdcwomm.supabase.co/functions/v1/evolution-webhook?provider=evolution_api`

**Webhook Evolution GO:**
`https://odwrohzvlzlzrkdcwomm.supabase.co/functions/v1/evolution-webhook?provider=evolution_go`

## Módulos implementados

| # | Módulo | Rota |
|---|---|---|
| 1 | Auth & Identidade | `/login`, `/signup`, `/profile` |
| 2 | Setores & Permissões | `/admin/sectors` |
| 3 | Produtos & Pipeline | `/admin/products` |
| 4 | Leads & CRM | `/admin/leads` |
| 5 | Atendimento Omnichannel | `/admin/inbox` |
| 6 | WhatsApp Evolution | `/admin/whatsapp` |

## Comandos

```bash
npm run dev          # Dev server em localhost:5173
npm run build        # Build de produção
# Type check:
node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit
```

## Convenções

- Hooks: `useNomeCamelCase.ts` em `src/hooks/`
- Páginas admin: `src/pages/admin/NomePage.tsx`
- UI components: `src/components/ui/nome.tsx` (lowercase, forwardRef)
- Edge Functions: `kebab-case` deployadas no Supabase

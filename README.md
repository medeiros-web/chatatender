# ChatAtender

CRM omnichannel multi-tenant SaaS com agentes de IA autônomos.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind v4 + shadcn/ui
- **State:** TanStack Query v5 + React Router v6 + React Hook Form + Zod
- **Backend:** Supabase (Auth + DB + Storage + Edge Functions Deno + Realtime)
- **WhatsApp:** Evolution API + Evolution GO

## Módulos

| # | Módulo | Status |
|---|---|---|
| 1 | Auth & Identidade | ✅ |
| 2 | Setores & Permissões | ✅ |
| 3 | Produtos & Pipeline | ✅ |
| 4 | Leads & CRM | ✅ |
| 5 | Atendimento Omnichannel | ✅ |
| 6 | WhatsApp Evolution | ✅ |
| 7 | IA Agentes Autônomos | 🔄 |
| 8–17 | Demais módulos | 📋 |

## Dev

```bash
npm install
npm run dev
```

## Variáveis de ambiente

Crie `.env.local`:

```env
VITE_SUPABASE_URL=https://odwrohzvlzlzrkdcwomm.supabase.co
VITE_SUPABASE_ANON_KEY=seu_anon_key
```

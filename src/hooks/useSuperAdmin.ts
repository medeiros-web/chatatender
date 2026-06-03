import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const db = supabase as any

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SAOrganization {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  owner_email?: string
  user_count?: number
  subscriptions?: { status: string; plans?: { name: string; slug: string } }[]
}

export interface SAUser {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  organization_id: string | null
  status: 'pending' | 'active' | 'rejected' | 'suspended'
  created_at: string
  org_name?: string
  role?: string
}

export interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_monthly: number
  price_annual: number
  max_users: number
  max_agents: number
  max_leads: number
  max_products: number
  features: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  organization_id: string
  plan_id: string | null
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string | null
  payment_provider: string | null
  payment_subscription_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  organizations?: { name: string; slug: string }
  plans?: { name: string; slug: string }
}

export interface PlatformSetting {
  id: string
  key: string
  value: string | null
  value_json: Record<string, unknown> | null
  description: string | null
  is_secret: boolean
  updated_at: string
}

export interface Release {
  id: string
  version: string
  title: string
  description: string | null
  type: 'major' | 'minor' | 'patch' | 'hotfix'
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface HelpArticle {
  id: string
  category: string
  title: string
  slug: string
  content: string
  is_published: boolean
  view_count: number
  created_at: string
  updated_at: string
}

export interface SupportTicket {
  id: string
  organization_id: string | null
  user_id: string | null
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  organizations?: { name: string }
  profiles?: { full_name: string | null; email: string }
}

export interface AuditLog {
  id: string
  organization_id: string | null
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  organizations?: { name: string }
  profiles?: { full_name: string | null; email: string }
}

export interface HealthCheck {
  id: string
  service: string
  status: 'ok' | 'degraded' | 'down'
  latency_ms: number | null
  message: string | null
  checked_at: string
}

export interface SAStats {
  totalOrgs: number
  activeOrgs: number
  totalUsers: number
  activeSubscriptions: number
  openTickets: number
}

// ── Platform Stats ─────────────────────────────────────────────────────────────

export function useSAStats() {
  return useQuery<SAStats>({
    queryKey: ['sa_stats'],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const [orgs, users, subs, tickets] = await Promise.all([
        db.from('organizations').select('id, is_active', { count: 'exact' }),
        db.from('profiles').select('id', { count: 'exact', head: true }),
        db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ])
      const allOrgs: any[] = orgs.data ?? []
      return {
        totalOrgs: orgs.count ?? allOrgs.length,
        activeOrgs: allOrgs.filter((o: any) => o.is_active).length,
        totalUsers: users.count ?? 0,
        activeSubscriptions: subs.count ?? 0,
        openTickets: tickets.count ?? 0,
      }
    },
  })
}

// ── Organizations ─────────────────────────────────────────────────────────────

export function useSAOrganizations() {
  return useQuery<SAOrganization[]>({
    queryKey: ['sa_organizations'],
    queryFn: async () => {
      const { data, error } = await db
        .from('organizations')
        .select('*, subscriptions(status, plans(name, slug))')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SAOrganization[]
    },
  })
}

export function useToggleOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db.from('organizations').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_organizations'] }),
  })
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function useSAUsers() {
  return useQuery<SAUser[]>({
    queryKey: ['sa_users'],
    queryFn: async () => {
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email, avatar_url, organization_id, status, created_at, organizations(name), user_roles(role)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []).map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email ?? '',
        avatar_url: u.avatar_url,
        organization_id: u.organization_id,
        status: u.status ?? 'active',
        created_at: u.created_at,
        org_name: u.organizations?.name ?? null,
        role: u.user_roles?.[0]?.role ?? null,
      }))
    },
  })
}

export function useSetUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'active' | 'rejected' | 'suspended' }) => {
      const { error } = await db.rpc('set_user_status', { p_user_id: userId, p_status: status })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_users'] }),
  })
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ['sa_plans'],
    queryFn: async () => {
      const { data, error } = await db.from('plans').select('*').order('sort_order')
      if (error) throw error
      return (data ?? []).map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
      }))
    },
  })
}

export function useUpsertPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Plan> & { name: string; slug: string }) => {
      const { error } = await db.from('plans').upsert(values)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_plans'] }),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('plans').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_plans'] }),
  })
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export function useSASubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: ['sa_subscriptions'],
    queryFn: async () => {
      const { data, error } = await db
        .from('subscriptions')
        .select('*, organizations(name, slug), plans(name, slug)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Subscription[]
    },
  })
}

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Subscription> & { id: string }) => {
      const { id, ...rest } = values
      const { error } = await db.from('subscriptions').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_subscriptions'] }),
  })
}

// ── Platform Settings ─────────────────────────────────────────────────────────

export function usePlatformSettings() {
  return useQuery<PlatformSetting[]>({
    queryKey: ['sa_platform_settings'],
    queryFn: async () => {
      const { data, error } = await db.from('platform_settings').select('*').order('key')
      if (error) throw error
      return (data ?? []) as PlatformSetting[]
    },
  })
}

export function useUpdatePlatformSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await db.from('platform_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_platform_settings'] }),
  })
}

// ── Releases ──────────────────────────────────────────────────────────────────

export function useReleases() {
  return useQuery<Release[]>({
    queryKey: ['sa_releases'],
    queryFn: async () => {
      const { data, error } = await db.from('releases').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Release[]
    },
  })
}

export function useUpsertRelease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Release> & { version: string; title: string }) => {
      const { error } = await db.from('releases').upsert(values)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_releases'] }),
  })
}

export function useDeleteRelease() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('releases').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_releases'] }),
  })
}

// ── Help Articles ─────────────────────────────────────────────────────────────

export function useHelpArticles() {
  return useQuery<HelpArticle[]>({
    queryKey: ['sa_help_articles'],
    queryFn: async () => {
      const { data, error } = await db.from('help_articles').select('*').order('category').order('title')
      if (error) throw error
      return (data ?? []) as HelpArticle[]
    },
  })
}

export function useUpsertHelpArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<HelpArticle> & { title: string; slug: string }) => {
      const { error } = await db.from('help_articles').upsert(values)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_help_articles'] }),
  })
}

export function useDeleteHelpArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('help_articles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_help_articles'] }),
  })
}

// ── Support Tickets ───────────────────────────────────────────────────────────

export function useSupportTickets(status?: string) {
  return useQuery<SupportTicket[]>({
    queryKey: ['sa_support_tickets', status],
    queryFn: async () => {
      let q = db
        .from('support_tickets')
        .select('*, organizations(name), profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (status && status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as SupportTicket[]
    },
  })
}

export function useUpdateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<SupportTicket> & { id: string }) => {
      const { id, ...rest } = values
      if (rest.status === 'resolved' && !rest.resolved_at) rest.resolved_at = new Date().toISOString()
      const { error } = await db.from('support_tickets').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_support_tickets'] }),
  })
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export function useAuditLogs(limit = 100) {
  return useQuery<AuditLog[]>({
    queryKey: ['sa_audit_logs', limit],
    queryFn: async () => {
      const { data, error } = await db
        .from('audit_logs')
        .select('*, organizations(name), profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as AuditLog[]
    },
  })
}

// ── System Health ─────────────────────────────────────────────────────────────

export function useSystemHealth() {
  return useQuery<HealthCheck[]>({
    queryKey: ['sa_system_health'],
    staleTime: 1000 * 30,
    queryFn: async () => {
      // Read last checks per service
      const { data } = await db
        .from('system_health_checks')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(50)
      return (data ?? []) as HealthCheck[]
    },
  })
}

export function useRunHealthChecks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const services = [
        { service: 'supabase_db', test: () => db.from('organizations').select('id', { count: 'exact', head: true }) },
        { service: 'supabase_auth', test: () => supabase.auth.getSession() },
      ]
      const results = await Promise.all(services.map(async s => {
        const t0 = Date.now()
        try {
          await s.test()
          const latency = Date.now() - t0
          return { service: s.service, status: 'ok', latency_ms: latency, message: null, checked_at: new Date().toISOString() }
        } catch (e: any) {
          return { service: s.service, status: 'down', latency_ms: null, message: e.message, checked_at: new Date().toISOString() }
        }
      }))
      await db.from('system_health_checks').insert(results)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa_system_health'] }),
  })
}

// ── AI Quality (agent_tool_executions) ────────────────────────────────────────

export interface AgentToolExecution {
  id: string
  organization_id: string
  agent_id: string
  conversation_id: string | null
  tool_name: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  status: string
  error_message: string | null
  duration_ms: number | null
  created_at: string
  ai_agents?: { name: string }
}

export function useAgentToolExecutions(limit = 100) {
  return useQuery<AgentToolExecution[]>({
    queryKey: ['sa_agent_executions', limit],
    queryFn: async () => {
      const { data, error } = await db
        .from('agent_tool_executions')
        .select('*, ai_agents(name)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as AgentToolExecution[]
    },
  })
}

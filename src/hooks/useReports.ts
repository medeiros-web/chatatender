import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { subDays, format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const db = supabase as any

// ── helpers ──────────────────────────────────────────────────────────────────

function last30Days() {
  const to   = new Date()
  const from = subDays(to, 29)
  return { from: startOfDay(from).toISOString(), to: endOfDay(to).toISOString() }
}

function thisMonth() {
  const now = new Date()
  return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
}

function lastMonth() {
  const prev = subMonths(new Date(), 1)
  return { from: startOfMonth(prev).toISOString(), to: endOfMonth(prev).toISOString() }
}

function groupByDay(items: { created_at: string }[], days = 30): { date: string; count: number }[] {
  const map = new Map<string, number>()
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    map.set(format(subDays(today, i), 'yyyy-MM-dd'), 0)
  }
  for (const item of items) {
    const key = format(new Date(item.created_at), 'yyyy-MM-dd')
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }))
}

// ── Platform Overview ─────────────────────────────────────────────────────────

export interface PlatformOverview {
  leadsTotal: number
  leadsThisMonth: number
  leadsGrowth: number
  conversationsTotal: number
  conversationsOpen: number
  conversationsThisMonth: number
  revenueThisMonth: number
  revenueGrowth: number
  activeUsers: number
  aiMessagesThisMonth: number
  aiAgentsActive: number
  errorsLast24h: number
}

export function usePlatformOverview() {
  const { organizationId } = useAuth()
  return useQuery<PlatformOverview>({
    queryKey: ['reports_overview', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { from: mFrom, to: mTo } = thisMonth()
      const { from: lmFrom, to: lmTo } = lastMonth()
      const yesterday = subDays(new Date(), 1).toISOString()

      const [
        leadsTotal,
        leadsThis,
        leadsLast,
        convsTotal,
        convsOpen,
        convsThis,
        commThis,
        commLast,
        users,
        aiLogsThis,
        agents,
        errorLogs,
      ] = await Promise.all([
        db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', mFrom).lte('created_at', mTo),
        db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', lmFrom).lte('created_at', lmTo),
        db.from('webchat_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        db.from('webchat_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'open'),
        db.from('webchat_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', mFrom).lte('created_at', mTo),
        db.from('commissions').select('deal_value').eq('organization_id', organizationId).neq('status', 'cancelled').gte('created_at', mFrom).lte('created_at', mTo),
        db.from('commissions').select('deal_value').eq('organization_id', organizationId).neq('status', 'cancelled').gte('created_at', lmFrom).lte('created_at', lmTo),
        db.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        db.from('agent_action_logs').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', mFrom).lte('created_at', mTo),
        db.from('product_agents').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true),
        db.from('agent_action_logs').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('success', false).gte('created_at', yesterday),
      ])

      const revThis  = ((commThis.data ?? []) as any[]).reduce((s: number, r: any) => s + (r.deal_value ?? 0), 0)
      const revLast  = ((commLast.data ?? []) as any[]).reduce((s: number, r: any) => s + (r.deal_value ?? 0), 0)
      const revGrowth = revLast ? Math.round(((revThis - revLast) / revLast) * 100) : 0
      const leadsGrowth = (leadsLast.count ?? 0) ? Math.round((((leadsThis.count ?? 0) - (leadsLast.count ?? 0)) / (leadsLast.count ?? 0)) * 100) : 0

      return {
        leadsTotal: leadsTotal.count ?? 0,
        leadsThisMonth: leadsThis.count ?? 0,
        leadsGrowth,
        conversationsTotal: convsTotal.count ?? 0,
        conversationsOpen: convsOpen.count ?? 0,
        conversationsThisMonth: convsThis.count ?? 0,
        revenueThisMonth: revThis,
        revenueGrowth: revGrowth,
        activeUsers: users.count ?? 0,
        aiMessagesThisMonth: aiLogsThis.count ?? 0,
        aiAgentsActive: agents.count ?? 0,
        errorsLast24h: errorLogs.count ?? 0,
      }
    },
  })
}

// ── Time Series ───────────────────────────────────────────────────────────────

export interface TimeSeriesPoint { date: string; count: number }

export function useLeadsTimeSeries() {
  const { organizationId } = useAuth()
  return useQuery<TimeSeriesPoint[]>({
    queryKey: ['reports_leads_series', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { from, to } = last30Days()
      const { data, error } = await db
        .from('leads')
        .select('created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', from)
        .lte('created_at', to)
      if (error) throw error
      return groupByDay(data ?? [])
    },
  })
}

export function useConversationsTimeSeries() {
  const { organizationId } = useAuth()
  return useQuery<TimeSeriesPoint[]>({
    queryKey: ['reports_convs_series', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { from, to } = last30Days()
      const { data, error } = await db
        .from('webchat_conversations')
        .select('created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', from)
        .lte('created_at', to)
      if (error) throw error
      return groupByDay(data ?? [])
    },
  })
}

export function useAIActivityTimeSeries() {
  const { organizationId } = useAuth()
  return useQuery<TimeSeriesPoint[]>({
    queryKey: ['reports_ai_series', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { from, to } = last30Days()
      const { data, error } = await db
        .from('agent_action_logs')
        .select('created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', from)
        .lte('created_at', to)
      if (error) throw error
      return groupByDay(data ?? [])
    },
  })
}

// ── Leads Detail ──────────────────────────────────────────────────────────────

export interface LeadsBySource { source: string; count: number }
export interface LeadsByStage  { stage: string; count: number; color: string }

export function useLeadsBySource() {
  const { organizationId } = useAuth()
  return useQuery<LeadsBySource[]>({
    queryKey: ['reports_leads_source', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await db
        .from('leads')
        .select('source')
        .eq('organization_id', organizationId)
      if (error) throw error
      const map = new Map<string, number>()
      for (const r of (data ?? []) as any[]) {
        const s = r.source || 'Direto'
        map.set(s, (map.get(s) ?? 0) + 1)
      }
      return Array.from(map.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    },
  })
}

export function useLeadsByStage() {
  const { organizationId } = useAuth()
  return useQuery<LeadsByStage[]>({
    queryKey: ['reports_leads_stage', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await db
        .from('leads')
        .select('current_stage_id, pipeline_stages(name, color)')
        .eq('organization_id', organizationId)
        .eq('is_archived', false)
      if (error) throw error
      const map = new Map<string, { count: number; color: string }>()
      for (const r of (data ?? []) as any[]) {
        const stage = r.pipeline_stages?.name ?? 'Sem etapa'
        const color = r.pipeline_stages?.color ?? '#6366f1'
        const prev  = map.get(stage) ?? { count: 0, color }
        map.set(stage, { count: prev.count + 1, color })
      }
      return Array.from(map.entries())
        .map(([stage, { count, color }]) => ({ stage, count, color }))
        .sort((a, b) => b.count - a.count)
    },
  })
}

// ── User Activity ─────────────────────────────────────────────────────────────

export interface UserActivity {
  id: string
  name: string
  avatar_url: string | null
  leadsAssigned: number
  conversationsHandled: number
  dealsWon: number
  revenue: number
}

export function useUserActivity() {
  const { organizationId } = useAuth()
  return useQuery<UserActivity[]>({
    queryKey: ['reports_user_activity', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { from, to } = thisMonth()

      const [profiles, leadsAssigned, convHandled, commissions] = await Promise.all([
        db.from('profiles').select('id, full_name, avatar_url').eq('organization_id', organizationId),
        db.from('leads').select('assigned_to').eq('organization_id', organizationId).gte('created_at', from).lte('created_at', to),
        db.from('webchat_conversations').select('assigned_user_id').eq('organization_id', organizationId).gte('created_at', from).lte('created_at', to).not('assigned_user_id', 'is', null),
        db.from('commissions').select('user_id, deal_value, status').eq('organization_id', organizationId).gte('created_at', from).lte('created_at', to),
      ])

      const leadMap = new Map<string, number>()
      for (const r of (leadsAssigned.data ?? []) as any[]) {
        if (r.assigned_to) leadMap.set(r.assigned_to, (leadMap.get(r.assigned_to) ?? 0) + 1)
      }

      const convMap = new Map<string, number>()
      for (const r of (convHandled.data ?? []) as any[]) {
        if (r.assigned_user_id) convMap.set(r.assigned_user_id, (convMap.get(r.assigned_user_id) ?? 0) + 1)
      }

      const wonMap = new Map<string, number>()
      const revMap = new Map<string, number>()
      for (const r of (commissions.data ?? []) as any[]) {
        if (r.status !== 'cancelled' && r.user_id) {
          wonMap.set(r.user_id, (wonMap.get(r.user_id) ?? 0) + 1)
          revMap.set(r.user_id, (revMap.get(r.user_id) ?? 0) + (r.deal_value ?? 0))
        }
      }

      return ((profiles.data ?? []) as any[])
        .map((p: any) => ({
          id: p.id,
          name: p.full_name ?? 'Usuário',
          avatar_url: p.avatar_url,
          leadsAssigned: leadMap.get(p.id) ?? 0,
          conversationsHandled: convMap.get(p.id) ?? 0,
          dealsWon: wonMap.get(p.id) ?? 0,
          revenue: revMap.get(p.id) ?? 0,
        }))
        .sort((a: UserActivity, b: UserActivity) => b.revenue - a.revenue)
    },
  })
}

// ── Conversations Detail ──────────────────────────────────────────────────────

export interface ConversationsByStatus { status: string; count: number }
export interface ConversationsBySector { sector: string; count: number }

export function useConversationsDetail() {
  const { organizationId } = useAuth()
  return useQuery<{ byStatus: ConversationsByStatus[]; bySector: ConversationsBySector[] }>({
    queryKey: ['reports_convs_detail', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [byStatus, bySector] = await Promise.all([
        db.from('webchat_conversations').select('status').eq('organization_id', organizationId),
        db.from('webchat_conversations').select('status, sectors(name)').eq('organization_id', organizationId).not('sector_id', 'is', null),
      ])

      const statusMap = new Map<string, number>()
      for (const r of (byStatus.data ?? []) as any[]) {
        const s = r.status ?? 'unknown'
        statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
      }

      const sectorMap = new Map<string, number>()
      for (const r of (bySector.data ?? []) as any[]) {
        const s = r.sectors?.name ?? 'Sem setor'
        sectorMap.set(s, (sectorMap.get(s) ?? 0) + 1)
      }

      return {
        byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
        bySector: Array.from(sectorMap.entries()).map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count).slice(0, 6),
      }
    },
  })
}

// ── AI Agents ─────────────────────────────────────────────────────────────────

export interface AIAgentStat {
  id: string
  name: string
  product: string
  provider: string
  model: string
  messagesThisMonth: number
  toolExecutions: number
  errors: number
  successRate: number
}

export function useAIAgentsStats() {
  const { organizationId } = useAuth()
  return useQuery<AIAgentStat[]>({
    queryKey: ['reports_ai_agents', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { from, to } = thisMonth()

      const [agents, logs, tools] = await Promise.all([
        db.from('product_agents').select('id, name, provider, model, products(name)').eq('organization_id', organizationId).eq('is_active', true),
        db.from('agent_action_logs').select('agent_id, success').eq('organization_id', organizationId).gte('created_at', from).lte('created_at', to),
        db.from('agent_tool_executions').select('agent_id').eq('organization_id', organizationId).gte('created_at', from).lte('created_at', to),
      ])

      const totalMap   = new Map<string, number>()
      const successMap = new Map<string, number>()
      for (const r of (logs.data ?? []) as any[]) {
        if (!r.agent_id) continue
        totalMap.set(r.agent_id, (totalMap.get(r.agent_id) ?? 0) + 1)
        if (r.success) successMap.set(r.agent_id, (successMap.get(r.agent_id) ?? 0) + 1)
      }

      const toolMap = new Map<string, number>()
      for (const r of (tools.data ?? []) as any[]) {
        if (r.agent_id) toolMap.set(r.agent_id, (toolMap.get(r.agent_id) ?? 0) + 1)
      }

      return ((agents.data ?? []) as any[]).map((a: any) => {
        const total   = totalMap.get(a.id) ?? 0
        const success = successMap.get(a.id) ?? 0
        return {
          id: a.id,
          name: a.name ?? 'Agente',
          product: a.products?.name ?? '—',
          provider: a.provider ?? '—',
          model: a.model ?? '—',
          messagesThisMonth: total,
          toolExecutions: toolMap.get(a.id) ?? 0,
          errors: total - success,
          successRate: total > 0 ? Math.round((success / total) * 100) : 100,
        }
      })
    },
  })
}

// ── System Logs ───────────────────────────────────────────────────────────────

export interface SystemLog {
  id: string
  type: 'error' | 'warning' | 'info'
  source: string
  message: string
  detail: string | null
  created_at: string
}

export function useSystemLogs() {
  const { organizationId } = useAuth()
  return useQuery<SystemLog[]>({
    queryKey: ['reports_system_logs', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const [aiErrors, auditLogs] = await Promise.all([
        db.from('agent_action_logs')
          .select('id, agent_id, action_type, success, error_message, created_at, ai_model')
          .eq('organization_id', organizationId)
          .eq('success', false)
          .order('created_at', { ascending: false })
          .limit(30),
        db.from('audit_logs')
          .select('id, action, resource_type, details, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const logs: SystemLog[] = []

      for (const r of (aiErrors.data ?? []) as any[]) {
        logs.push({
          id: r.id,
          type: 'error',
          source: `Agente IA · ${r.ai_model ?? r.agent_id ?? '—'}`,
          message: r.error_message ?? `Falha em ${r.action_type}`,
          detail: r.action_type,
          created_at: r.created_at,
        })
      }

      for (const r of (auditLogs.data ?? []) as any[]) {
        logs.push({
          id: r.id,
          type: 'info',
          source: `Auditoria · ${r.resource_type ?? '—'}`,
          message: r.action ?? '—',
          detail: typeof r.details === 'object' ? JSON.stringify(r.details).slice(0, 80) : String(r.details ?? ''),
          created_at: r.created_at,
        })
      }

      return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
  })
}

// ── Recent Leads for table ────────────────────────────────────────────────────

export interface ReportLead {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string
  stage: string | null
  score: number
  created_at: string
  assigned: string | null
}

export function useReportLeads() {
  const { organizationId } = useAuth()
  return useQuery<ReportLead[]>({
    queryKey: ['reports_leads_table', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await db
        .from('leads')
        .select('id, name, email, phone, source, lead_score, created_at, pipeline_stages(name), profiles!leads_assigned_to_fkey(full_name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        source: r.source ?? 'Direto',
        stage: r.pipeline_stages?.name ?? null,
        score: r.lead_score ?? 0,
        created_at: r.created_at,
        assigned: r.profiles?.full_name ?? null,
      }))
    },
  })
}

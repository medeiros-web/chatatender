import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

const db = supabase as any

function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  return { from, to }
}

export interface DashboardStats {
  leadsTotal: number
  leadsThisMonth: number
  leadsGrowth: number          // % vs last month
  openConversations: number
  revenueThisMonth: number
  revenueGrowth: number
  pendingCommissions: number
  dealsWonThisMonth: number
}

export interface RecentLead {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string
  created_at: string
  stage: string | null
}

export interface RecentConversation {
  id: string
  contact_name: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

export function useDashboardStats() {
  const { organizationId } = useAuth()
  return useQuery<DashboardStats>({
    queryKey: ['dashboard_stats', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { from, to } = monthRange()
      const now = new Date()
      const lastMonthFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthTo   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

      const [
        totalLeads,
        thisMonthLeads,
        lastMonthLeads,
        openConvs,
        thisMonthComm,
        lastMonthComm,
        pendingComm,
        wonDeals,
      ] = await Promise.all([
        db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', from).lte('created_at', to),
        db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).gte('created_at', lastMonthFrom).lte('created_at', lastMonthTo),
        db.from('conversations').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'open'),
        db.from('commissions').select('deal_value').eq('organization_id', organizationId).neq('status', 'cancelled').gte('created_at', from).lte('created_at', to),
        db.from('commissions').select('deal_value').eq('organization_id', organizationId).neq('status', 'cancelled').gte('created_at', lastMonthFrom).lte('created_at', lastMonthTo),
        db.from('commissions').select('commission_value').eq('organization_id', organizationId).eq('status', 'pending'),
        db.from('deals').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'won').gte('created_at', from).lte('created_at', to),
      ])

      const revenueThis  = ((thisMonthComm.data ?? []) as any[]).reduce((s: number, r: any) => s + (r.deal_value ?? 0), 0)
      const revenueLast  = ((lastMonthComm.data ?? []) as any[]).reduce((s: number, r: any) => s + (r.deal_value ?? 0), 0)
      const pendingTotal = ((pendingComm.data ?? []) as any[]).reduce((s: number, r: any) => s + (r.commission_value ?? 0), 0)

      const leadsGrowth   = lastMonthLeads.count ? Math.round(((thisMonthLeads.count - lastMonthLeads.count) / lastMonthLeads.count) * 100) : 0
      const revenueGrowth = revenueLast ? Math.round(((revenueThis - revenueLast) / revenueLast) * 100) : 0

      return {
        leadsTotal: totalLeads.count ?? 0,
        leadsThisMonth: thisMonthLeads.count ?? 0,
        leadsGrowth,
        openConversations: openConvs.count ?? 0,
        revenueThisMonth: revenueThis,
        revenueGrowth,
        pendingCommissions: pendingTotal,
        dealsWonThisMonth: wonDeals.count ?? 0,
      }
    },
  })
}

export function useRecentLeads() {
  const { organizationId } = useAuth()
  return useQuery<RecentLead[]>({
    queryKey: ['dashboard_recent_leads', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await db
        .from('leads')
        .select('id, name, email, phone, source, created_at, pipeline_stages(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        source: r.source,
        created_at: r.created_at,
        stage: r.pipeline_stages?.name ?? null,
      }))
    },
  })
}

export function useRecentConversations() {
  const { organizationId } = useAuth()
  return useQuery<RecentConversation[]>({
    queryKey: ['dashboard_recent_convs', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await db
        .from('conversations')
        .select('id, contact_name, last_message, last_message_at, unread_count')
        .eq('organization_id', organizationId)
        .eq('status', 'open')
        .order('last_message_at', { ascending: false })
        .limit(6)
      if (error) throw error
      return (data ?? []) as RecentConversation[]
    },
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SalesSquad {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  squad_members?: SquadMember[]
}

export interface SquadMember {
  id: string
  squad_id: string
  user_id: string
  role: 'leader' | 'seller'
  joined_at: string
  profiles?: { full_name: string | null; email: string }
}

export interface CommissionRule {
  id: string
  organization_id: string
  product_id: string | null
  name: string
  rule_type: 'percentage' | 'fixed'
  base_value: number
  min_value: number | null
  max_value: number | null
  is_default: boolean
  applies_to_role: string | null
  created_at: string
  updated_at: string
  products?: { name: string }
}

export interface Commission {
  id: string
  organization_id: string
  rule_id: string | null
  deal_id: string | null
  user_id: string
  product_id: string | null
  deal_value: number
  commission_value: number
  rule_type: string
  base_value: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  profiles?: { full_name: string | null; avatar_url: string | null }
  products?: { name: string }
  deals?: { title: string | null }
}

export interface SalesGoal {
  id: string
  organization_id: string
  user_id: string | null
  squad_id: string | null
  product_id: string | null
  title: string
  metric: 'revenue' | 'deals_count' | 'leads_count'
  target_value: number
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom'
  period_start: string
  period_end: string
  is_active: boolean
  created_at: string
  updated_at: string
  profiles?: { full_name: string | null }
  sales_squads?: { name: string }
}

export interface DistributionConfig {
  id: string
  organization_id: string
  product_id: string | null
  strategy: 'round_robin' | 'least_busy' | 'performance'
  is_active: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Leaderboard entry (computed from commissions) ─────────────────────────────

export interface LeaderboardEntry {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  deals_won: number
  revenue: number
  commission: number
  rank: number
}

// ── Squads ────────────────────────────────────────────────────────────────────

export function useSalesSquads() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['sales_squads', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sales_squads')
        .select('*, squad_members(*, profiles(full_name, email))')
        .eq('organization_id', organizationId)
        .order('created_at')
      if (error) throw error
      return data as SalesSquad[]
    },
  })
}

export function useCreateSquad() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: { name: string; description?: string }) => {
      const { error } = await (supabase as any)
        .from('sales_squads')
        .insert({ ...values, organization_id: organizationId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales_squads'] }),
  })
}

export function useDeleteSquad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('sales_squads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales_squads'] }),
  })
}

// ── Commission Rules ──────────────────────────────────────────────────────────

export function useCommissionRules() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['commission_rules', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('commission_rules')
        .select('*, products(name)')
        .eq('organization_id', organizationId)
        .order('is_default', { ascending: false })
        .order('created_at')
      if (error) throw error
      return data as CommissionRule[]
    },
  })
}

export function useUpsertCommissionRule() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<CommissionRule, 'organization_id' | 'created_at' | 'updated_at' | 'products'>) => {
      const { error } = await (supabase as any)
        .from('commission_rules')
        .upsert({ ...values, organization_id: organizationId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission_rules'] }),
  })
}

export function useDeleteCommissionRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('commission_rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission_rules'] }),
  })
}

// ── Commissions ───────────────────────────────────────────────────────────────

export function useCommissions(params?: { userId?: string; status?: Commission['status'] }) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['commissions', organizationId, params],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('commissions')
        .select('*, profiles(full_name, avatar_url), products(name), deals(title)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (params?.userId)  q = q.eq('user_id', params.userId)
      if (params?.status)  q = q.eq('status', params.status)
      const { data, error } = await q
      if (error) throw error
      return data as Commission[]
    },
  })
}

export function useUpdateCommissionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, paid_at }: {
      id: string
      status: Commission['status']
      paid_at?: string
    }) => {
      const { error } = await (supabase as any)
        .from('commissions')
        .update({ status, paid_at: paid_at ?? null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  })
}

// ── Sales Goals ───────────────────────────────────────────────────────────────

export function useSalesGoals() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['sales_goals', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sales_goals')
        .select('*, profiles(full_name), sales_squads(name)')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('period_start', { ascending: false })
      if (error) throw error
      return data as SalesGoal[]
    },
  })
}

export function useUpsertSalesGoal() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<SalesGoal, 'organization_id' | 'created_at' | 'updated_at' | 'profiles' | 'sales_squads'>) => {
      const { error } = await (supabase as any)
        .from('sales_goals')
        .upsert({ ...values, organization_id: organizationId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales_goals'] }),
  })
}

export function useDeleteSalesGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('sales_goals')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales_goals'] }),
  })
}

// ── Distribution Config ───────────────────────────────────────────────────────

export function useDistributionConfig() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['distribution_config', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('distribution_config')
        .select('*')
        .eq('organization_id', organizationId)
      if (error) throw error
      return data as DistributionConfig[]
    },
  })
}

export function useSaveDistributionConfig() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: { strategy: DistributionConfig['strategy']; product_id?: string | null }) => {
      const { error } = await (supabase as any)
        .from('distribution_config')
        .upsert({
          organization_id: organizationId,
          product_id: values.product_id ?? null,
          strategy: values.strategy,
          is_active: true,
          config: {},
        }, { onConflict: 'organization_id,product_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['distribution_config'] }),
  })
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export function useLeaderboard(period: 'month' | 'quarter' | 'year' = 'month') {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['leaderboard', organizationId, period],
    enabled: !!organizationId,
    queryFn: async () => {
      // Period range
      const now = new Date()
      let from: Date
      if (period === 'month')   from = new Date(now.getFullYear(), now.getMonth(), 1)
      else if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3)
        from = new Date(now.getFullYear(), q * 3, 1)
      } else {
        from = new Date(now.getFullYear(), 0, 1)
      }

      const { data: commData, error } = await (supabase as any)
        .from('commissions')
        .select('user_id, deal_value, commission_value, profiles(full_name, avatar_url)')
        .eq('organization_id', organizationId)
        .eq('status', 'pending') // pending = earned but not yet paid
        .gte('created_at', from.toISOString())

      if (error) throw error

      // Aggregate by user
      const map = new Map<string, LeaderboardEntry>()
      for (const c of (commData ?? []) as any[]) {
        const uid = c.user_id
        if (!map.has(uid)) {
          map.set(uid, {
            user_id:    uid,
            full_name:  c.profiles?.full_name ?? null,
            avatar_url: c.profiles?.avatar_url ?? null,
            deals_won:  0,
            revenue:    0,
            commission: 0,
            rank: 0,
          })
        }
        const entry = map.get(uid)!
        entry.deals_won  += 1
        entry.revenue    += c.deal_value ?? 0
        entry.commission += c.commission_value ?? 0
      }

      // Sort by revenue desc and assign ranks
      const sorted = Array.from(map.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((e, i) => ({ ...e, rank: i + 1 }))

      return sorted
    },
  })
}

// ── Goal Progress ─────────────────────────────────────────────────────────────

export function useGoalProgress(goalId: string) {
  const { organizationId } = useAuth()
  const { data: goals = [] } = useSalesGoals()
  const goal = goals.find(g => g.id === goalId)

  return useQuery({
    queryKey: ['goal_progress', organizationId, goalId],
    enabled: !!organizationId && !!goal,
    queryFn: async () => {
      if (!goal) return 0

      const from = goal.period_start
      const to   = goal.period_end

      if (goal.metric === 'revenue') {
        const { data } = await (supabase as any)
          .from('commissions')
          .select('deal_value')
          .eq('organization_id', organizationId)
          .gte('created_at', from)
          .lte('created_at', to + 'T23:59:59')
          .neq('status', 'cancelled')
          .maybeSingle()
        // Sum all
        const { data: all } = await (supabase as any)
          .from('commissions')
          .select('deal_value')
          .eq('organization_id', organizationId)
          .gte('created_at', from)
          .lte('created_at', to + 'T23:59:59')
          .neq('status', 'cancelled')
        const total = ((all ?? []) as any[]).reduce((s: number, c: any) => s + (c.deal_value ?? 0), 0)
        return total
      } else if (goal.metric === 'deals_count') {
        const { count } = await (supabase as any)
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'won')
          .gte('created_at', from)
          .lte('created_at', to + 'T23:59:59')
        return count ?? 0
      } else {
        const { count } = await (supabase as any)
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('created_at', from)
          .lte('created_at', to + 'T23:59:59')
        return count ?? 0
      }
    },
  })
}

// ── Monthly commission sparkline data ─────────────────────────────────────────

export function useCommissionSparkline(userId?: string) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['commission_sparkline', organizationId, userId],
    enabled: !!organizationId,
    queryFn: async () => {
      // Last 6 months
      const months: { label: string; from: string; to: string }[] = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const from = d.toISOString().slice(0, 10)
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const to   = last.toISOString().slice(0, 10)
        months.push({
          label: d.toLocaleString('pt-BR', { month: 'short' }),
          from, to,
        })
      }

      const results = await Promise.all(months.map(async m => {
        let q = (supabase as any)
          .from('commissions')
          .select('commission_value')
          .eq('organization_id', organizationId)
          .neq('status', 'cancelled')
          .gte('created_at', m.from)
          .lte('created_at', m.to + 'T23:59:59')
        if (userId) q = q.eq('user_id', userId)
        const { data } = await q
        const total = ((data ?? []) as any[]).reduce((s: number, c: any) => s + (c.commission_value ?? 0), 0)
        return { label: m.label, value: total }
      }))

      return results
    },
  })
}

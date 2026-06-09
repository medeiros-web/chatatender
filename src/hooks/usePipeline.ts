import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { subDays, differenceInDays } from 'date-fns'

const db = supabase as any

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineStage {
  id: string
  name: string
  color: string
  position: number
  probability: number
  is_won: boolean
  is_lost: boolean
  product_id: string
  product_name: string
  leadCount: number
  dealCount: number
  totalValue: number
  weightedValue: number
  avgDaysInStage: number
  conversionFromPrev: number | null
}

export interface PipelineDeal {
  id: string
  title: string
  value: number
  currency: string
  probability: number
  expected_close: string | null
  closed_at: string | null
  status: string
  lost_reason: string | null
  created_at: string
  stage_id: string | null
  stageName: string
  stageColor: string
  leadName: string
  ownerName: string | null
  daysOpen: number
  healthScore: number
}

export interface PipelineLead {
  id: string
  name: string
  company: string | null
  lead_score: number
  source: string
  created_at: string
  stage_id: string | null
  stageName: string
  stageColor: string
  stageProbability: number
  assignedName: string | null
  dealValue: number
  daysInStage: number
}

export interface StageMovement {
  id: string
  leadName: string
  fromStage: string | null
  toStage: string | null
  changedBy: string | null
  created_at: string
}

export interface PipelineProduct {
  id: string
  name: string
}

export interface PipelineKPIs {
  totalPipelineValue: number
  weightedForecast: number
  avgDealSize: number
  avgDaysToClose: number
  totalDeals: number
  totalLeads: number
  wonThisMonth: number
  wonValueThisMonth: number
  healthScore: number
  staleDeals: number
}

// ── Products with stages ───────────────────────────────────────────────────────

export function usePipelineProducts() {
  const { organizationId } = useAuth()
  return useQuery<PipelineProduct[]>({
    queryKey: ['pipeline_products', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await db
        .from('products')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as PipelineProduct[]
    },
  })
}

// ── Full pipeline data ────────────────────────────────────────────────────────

export function usePipelineData(productId?: string | null) {
  const { organizationId } = useAuth()
  return useQuery<{
    stages: PipelineStage[]
    deals: PipelineDeal[]
    leads: PipelineLead[]
    kpis: PipelineKPIs
  }>({
    queryKey: ['pipeline_data', organizationId, productId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      // ── fetch all in parallel ────────────────────────────────────────────
      const stagesQ = db
        .from('pipeline_stages')
        .select('id, name, color, position, probability, is_won, is_lost, product_id, products(name)')
        .eq('organization_id', organizationId)
        .order('position')

      const leadsQ = db
        .from('leads')
        .select('id, name, company, lead_score, source, created_at, current_stage_id, assigned_to, pipeline_stages(name, color, probability), profiles!leads_assigned_to_fkey(full_name)')
        .eq('organization_id', organizationId)
        .eq('is_archived', false)

      const dealsQ = db
        .from('deals')
        .select('id, title, value, currency, probability, expected_close, closed_at, status, lost_reason, created_at, stage_id, lead_id, owner_id, pipeline_stages(name, color), leads(name), profiles!deals_owner_id_fkey(full_name)')
        .eq('organization_id', organizationId)

      const historyQ = db
        .from('lead_stage_history')
        .select('id, lead_id, from_stage_id, to_stage_id, created_at, leads(name), from_stage:pipeline_stages!lead_stage_history_from_stage_id_fkey(name), to_stage:pipeline_stages!lead_stage_history_to_stage_id_fkey(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(200)

      const [stagesRes, leadsRes, dealsRes, historyRes] = await Promise.all([stagesQ, leadsQ, dealsQ, historyQ])

      const rawStages = (stagesRes.data ?? []) as any[]
      const rawLeads  = (leadsRes.data ?? []) as any[]
      const rawDeals  = (dealsRes.data ?? []) as any[]
      const rawHistory = (historyRes.data ?? []) as any[]

      // Filter by product if selected
      const filteredStages = productId
        ? rawStages.filter((s: any) => s.product_id === productId)
        : rawStages
      const stageIds = new Set(filteredStages.map((s: any) => s.id))

      const filteredLeads = productId
        ? rawLeads.filter((l: any) => l.current_stage_id && stageIds.has(l.current_stage_id))
        : rawLeads

      const filteredDeals = productId
        ? rawDeals.filter((d: any) => d.stage_id && stageIds.has(d.stage_id))
        : rawDeals

      // ── Build lookup: stageId → avg days leads have been there ────────────
      // For each lead, find how many days since last stage change
      const lastMoveMap = new Map<string, number>() // lead_id → days
      const histByLead = new Map<string, any[]>()
      for (const h of rawHistory) {
        if (!h.lead_id) continue
        const arr = histByLead.get(h.lead_id) ?? []
        arr.push(h)
        histByLead.set(h.lead_id, arr)
      }
      for (const l of filteredLeads) {
        const moves = histByLead.get(l.id) ?? []
        if (moves.length > 0) {
          const latest = moves[0] // already sorted desc
          lastMoveMap.set(l.id, differenceInDays(now, new Date(latest.created_at)))
        } else {
          lastMoveMap.set(l.id, differenceInDays(now, new Date(l.created_at)))
        }
      }

      // ── Per-stage aggregations ────────────────────────────────────────────
      const stageLeadCount  = new Map<string, number>()
      const stageDealCount  = new Map<string, number>()
      const stageTotalValue = new Map<string, number>()
      const stageDaysArr    = new Map<string, number[]>()

      for (const l of filteredLeads) {
        const sid = l.current_stage_id
        if (!sid) continue
        stageLeadCount.set(sid, (stageLeadCount.get(sid) ?? 0) + 1)
        const daysArr = stageDaysArr.get(sid) ?? []
        daysArr.push(lastMoveMap.get(l.id) ?? 0)
        stageDaysArr.set(sid, daysArr)
      }

      for (const d of filteredDeals) {
        const sid = d.stage_id
        if (!sid || d.status === 'lost') continue
        stageDealCount.set(sid, (stageDealCount.get(sid) ?? 0) + 1)
        stageTotalValue.set(sid, (stageTotalValue.get(sid) ?? 0) + (d.value ?? 0))
      }

      // ── Conversion rates ──────────────────────────────────────────────────
      const sortedStages = [...filteredStages].sort((a, b) => a.position - b.position)
      const stages: PipelineStage[] = sortedStages.map((s: any, i: number) => {
        const leadCount  = stageLeadCount.get(s.id) ?? 0
        const dealCount  = stageDealCount.get(s.id) ?? 0
        const totalValue = stageTotalValue.get(s.id) ?? 0
        const days = stageDaysArr.get(s.id) ?? []
        const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0

        let conversionFromPrev: number | null = null
        if (i > 0) {
          const prevCount = stageLeadCount.get(sortedStages[i - 1].id) ?? 0
          conversionFromPrev = prevCount > 0 ? Math.round((leadCount / prevCount) * 100) : 0
        }

        return {
          id: s.id,
          name: s.name,
          color: s.color,
          position: s.position,
          probability: s.probability,
          is_won: s.is_won,
          is_lost: s.is_lost,
          product_id: s.product_id,
          product_name: s.products?.name ?? '—',
          leadCount,
          dealCount,
          totalValue,
          weightedValue: Math.round(totalValue * (s.probability / 100)),
          avgDaysInStage: avgDays,
          conversionFromPrev,
        }
      })

      // ── Deal list ─────────────────────────────────────────────────────────
      const deals: PipelineDeal[] = filteredDeals.map((d: any) => {
        const daysOpen = differenceInDays(now, new Date(d.created_at))
        const isOverdue = d.expected_close && new Date(d.expected_close) < now && d.status === 'open'
        const prob = d.probability ?? d.pipeline_stages?.probability ?? 0
        const healthScore = isOverdue ? 20
          : daysOpen > 60 ? 40
          : daysOpen > 30 ? 60
          : prob >= 70 ? 90
          : 70
        return {
          id: d.id,
          title: d.title ?? d.leads?.name ?? 'Negócio',
          value: d.value ?? 0,
          currency: d.currency ?? 'BRL',
          probability: prob,
          expected_close: d.expected_close,
          closed_at: d.closed_at,
          status: d.status,
          lost_reason: d.lost_reason,
          created_at: d.created_at,
          stage_id: d.stage_id,
          stageName: d.pipeline_stages?.name ?? '—',
          stageColor: d.pipeline_stages?.color ?? '#94a3b8',
          leadName: d.leads?.name ?? '—',
          ownerName: d.profiles?.full_name ?? null,
          daysOpen,
          healthScore,
        }
      }).sort((a: PipelineDeal, b: PipelineDeal) => b.value - a.value)

      // ── Lead list ─────────────────────────────────────────────────────────
      const dealByLead = new Map<string, number>()
      for (const d of filteredDeals) {
        if (d.lead_id && d.status !== 'lost') {
          dealByLead.set(d.lead_id, (dealByLead.get(d.lead_id) ?? 0) + (d.value ?? 0))
        }
      }

      const leads: PipelineLead[] = filteredLeads.map((l: any) => ({
        id: l.id,
        name: l.name,
        company: l.company,
        lead_score: l.lead_score ?? 0,
        source: l.source ?? 'Direto',
        created_at: l.created_at,
        stage_id: l.current_stage_id,
        stageName: l.pipeline_stages?.name ?? 'Sem etapa',
        stageColor: l.pipeline_stages?.color ?? '#94a3b8',
        stageProbability: l.pipeline_stages?.probability ?? 0,
        assignedName: l.profiles?.full_name ?? null,
        dealValue: dealByLead.get(l.id) ?? 0,
        daysInStage: lastMoveMap.get(l.id) ?? 0,
      }))

      // ── KPIs ──────────────────────────────────────────────────────────────
      const openDeals  = filteredDeals.filter((d: any) => d.status === 'open')
      const wonDeals   = filteredDeals.filter((d: any) => d.status === 'won' && d.closed_at >= monthStart && d.closed_at <= monthEnd)
      const totalPipelineValue = openDeals.reduce((s: number, d: any) => s + (d.value ?? 0), 0)
      const weightedForecast   = openDeals.reduce((s: number, d: any) => s + ((d.value ?? 0) * ((d.probability ?? 50) / 100)), 0)
      const wonValues = wonDeals.reduce((s: number, d: any) => s + (d.value ?? 0), 0)

      const closedWon = filteredDeals.filter((d: any) => d.status === 'won' && d.closed_at)
      const avgDaysToClose = closedWon.length
        ? Math.round(closedWon.reduce((s: number, d: any) => s + differenceInDays(new Date(d.closed_at), new Date(d.created_at)), 0) / closedWon.length)
        : 0

      const staleDeals = openDeals.filter((d: any) => differenceInDays(now, new Date(d.created_at)) > 30).length
      const healthScore = openDeals.length
        ? Math.max(0, Math.round(100 - (staleDeals / openDeals.length) * 50 - (openDeals.filter((d: any) => !d.expected_close).length / openDeals.length) * 30))
        : 100

      const kpis: PipelineKPIs = {
        totalPipelineValue,
        weightedForecast: Math.round(weightedForecast),
        avgDealSize: openDeals.length ? Math.round(totalPipelineValue / openDeals.length) : 0,
        avgDaysToClose,
        totalDeals: openDeals.length,
        totalLeads: filteredLeads.length,
        wonThisMonth: wonDeals.length,
        wonValueThisMonth: wonValues,
        healthScore,
        staleDeals,
      }

      return { stages, deals, leads, kpis }
    },
  })
}

// ── Stage movements (recent activity feed) ────────────────────────────────────

export function useStageMovements(limit = 15) {
  const { organizationId } = useAuth()
  return useQuery<StageMovement[]>({
    queryKey: ['pipeline_movements', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await db
        .from('lead_stage_history')
        .select('id, lead_id, created_at, leads(name), from_stage:pipeline_stages!lead_stage_history_from_stage_id_fkey(name), to_stage:pipeline_stages!lead_stage_history_to_stage_id_fkey(name), profiles!lead_stage_history_changed_by_fkey(full_name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []).map((h: any) => ({
        id: h.id,
        leadName: h.leads?.name ?? '—',
        fromStage: h.from_stage?.name ?? null,
        toStage: h.to_stage?.name ?? '—',
        changedBy: h.profiles?.full_name ?? null,
        created_at: h.created_at,
      }))
    },
  })
}

// ── Move lead stage ────────────────────────────────────────────────────────────

export function useMoveLead() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) => {
      const { error } = await db
        .from('leads')
        .update({ current_stage_id: stageId, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('organization_id', organizationId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline_data', organizationId] })
      qc.invalidateQueries({ queryKey: ['pipeline_movements', organizationId] })
    },
  })
}

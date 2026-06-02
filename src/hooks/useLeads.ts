import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Lead {
  id: string
  organization_id: string
  product_id: string | null
  current_stage_id: string | null
  name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  avatar_url: string | null
  sdr_id: string | null
  closer_id: string | null
  assigned_to: string | null
  lead_score: number
  source: string
  bant_budget: string | null
  bant_authority: string | null
  bant_need: string | null
  bant_timeline: string | null
  bant_score: number
  bant_answers: Record<string, unknown> | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
  landing_page: string | null
  fbclid: string | null
  gclid: string | null
  notes: string | null
  custom_fields: Record<string, unknown> | null
  is_archived: boolean
  last_contact_at: string | null
  next_follow_up_at: string | null
  created_at: string
  updated_at: string
}

export interface LeadWithRelations extends Lead {
  pipeline_stages: { id: string; name: string; color: string; position: number; is_won: boolean; is_lost: boolean } | null
  profiles_assigned: { full_name: string | null; avatar_url: string | null } | null
  lead_tag_assignments: {
    id: string
    tag_id: string
    lead_tags: { id: string; name: string; color: string; is_lifecycle_status: boolean }
  }[]
}

export interface LeadFilters {
  stageId?: string
  tagIds?: string[]
  minScore?: number
  maxScore?: number
  source?: string
  assignedTo?: string
  productId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  isArchived?: boolean
}

export function useLeads(filters: LeadFilters = {}) {
  const { organizationId } = useAuth()

  return useQuery<LeadWithRelations[]>({
    queryKey: ['leads', organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return []

      let q = db.from('leads')
        .select(`
          *,
          pipeline_stages(id, name, color, position, is_won, is_lost),
          profiles_assigned:profiles!leads_assigned_to_fkey(full_name, avatar_url),
          lead_tag_assignments(
            id, tag_id,
            lead_tags(id, name, color, is_lifecycle_status)
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_archived', filters.isArchived ?? false)
        .order('created_at', { ascending: false })

      if (filters.stageId)    q = q.eq('current_stage_id', filters.stageId)
      if (filters.productId)  q = q.eq('product_id', filters.productId)
      if (filters.assignedTo) q = q.eq('assigned_to', filters.assignedTo)
      if (filters.source)     q = q.eq('source', filters.source)
      if (filters.minScore != null) q = q.gte('lead_score', filters.minScore)
      if (filters.maxScore != null) q = q.lte('lead_score', filters.maxScore)
      if (filters.dateFrom)   q = q.gte('created_at', filters.dateFrom)
      if (filters.dateTo)     q = q.lte('created_at', filters.dateTo)
      if (filters.search)     q = q.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)

      const { data, error } = await q
      if (error) throw error
      return data as LeadWithRelations[]
    },
    enabled: !!organizationId,
  })
}

export function useLead(leadId: string | undefined) {
  return useQuery<LeadWithRelations | null>({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      if (!leadId) return null
      const { data, error } = await db
        .from('leads')
        .select(`
          *,
          pipeline_stages(id, name, color, position, is_won, is_lost),
          profiles_assigned:profiles!leads_assigned_to_fkey(full_name, avatar_url),
          lead_tag_assignments(id, tag_id, lead_tags(id, name, color, is_lifecycle_status))
        `)
        .eq('id', leadId)
        .single()
      if (error) throw error
      return data as LeadWithRelations
    },
    enabled: !!leadId,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()

  return useMutation({
    mutationFn: async (values: Partial<Lead> & { name: string }) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('leads')
        .insert({ ...values, organization_id: organizationId, assigned_to: values.assigned_to ?? user?.id })
        .select().single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', organizationId] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Lead> & { id: string }) => {
      const { data, error } = await db.from('leads').update(values).eq('id', id).select().single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leads', organizationId] })
      qc.invalidateQueries({ queryKey: ['lead', vars.id] })
    },
  })
}

export function useMoveLeadStage() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()

  return useMutation({
    mutationFn: async ({
      leadId, fromStageId, toStageId,
    }: { leadId: string; fromStageId: string | null; toStageId: string }) => {
      const { error: e1 } = await db.from('leads').update({ current_stage_id: toStageId }).eq('id', leadId)
      if (e1) throw e1
      await db.from('lead_stage_history').insert({
        lead_id: leadId,
        organization_id: organizationId,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        changed_by: user?.id,
      })
      await db.from('interactions').insert({
        lead_id: leadId,
        organization_id: organizationId,
        user_id: user?.id,
        type: 'stage_change',
        metadata: { from_stage_id: fromStageId, to_stage_id: toStageId },
      })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leads', organizationId] })
      qc.invalidateQueries({ queryKey: ['lead', vars.leadId] })
      qc.invalidateQueries({ queryKey: ['lead-timeline', vars.leadId] })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('leads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', organizationId] }),
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ── Lead Notes ────────────────────────────────────────────────
export interface LeadNote {
  id: string
  lead_id: string
  organization_id: string
  user_id: string | null
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  profiles?: { full_name: string | null; avatar_url: string | null }
}

export function useLeadNotes(leadId: string | undefined) {
  return useQuery<LeadNote[]>({
    queryKey: ['lead-notes', leadId],
    queryFn: async () => {
      if (!leadId) return []
      const { data, error } = await db
        .from('lead_notes')
        .select('*, profiles(full_name, avatar_url)')
        .eq('lead_id', leadId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as LeadNote[]
    },
    enabled: !!leadId,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()
  return useMutation({
    mutationFn: async ({ leadId, content, isPinned = false }: { leadId: string; content: string; isPinned?: boolean }) => {
      const { data, error } = await db.from('lead_notes').insert({
        lead_id: leadId,
        organization_id: organizationId,
        user_id: user?.id,
        content,
        is_pinned: isPinned,
      }).select().single()
      if (error) throw error
      // Registra interaction
      await db.from('interactions').insert({
        lead_id: leadId,
        organization_id: organizationId,
        user_id: user?.id,
        type: 'note',
        content,
      })
      return data as LeadNote
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-notes', vars.leadId] })
      qc.invalidateQueries({ queryKey: ['lead-timeline', vars.leadId] })
    },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await db.from('lead_notes').delete().eq('id', id)
      if (error) throw error
      return leadId
    },
    onSuccess: (leadId: string) => qc.invalidateQueries({ queryKey: ['lead-notes', leadId] }),
  })
}

// ── Lead Tags ─────────────────────────────────────────────────
export interface LeadTag {
  id: string
  organization_id: string
  name: string
  color: string
  is_lifecycle_status: boolean
  created_at: string
}

export function useLeadTags() {
  const { organizationId } = useAuth()
  return useQuery<LeadTag[]>({
    queryKey: ['lead-tags', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db.from('lead_tags').select('*').eq('organization_id', organizationId).order('name')
      if (error) throw error
      return data as LeadTag[]
    },
    enabled: !!organizationId,
  })
}

export function useCreateLeadTag() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async ({ name, color, isLifecycle = false }: { name: string; color: string; isLifecycle?: boolean }) => {
      const { data, error } = await db.from('lead_tags').insert({
        organization_id: organizationId,
        name, color,
        is_lifecycle_status: isLifecycle,
      }).select().single()
      if (error) throw error
      return data as LeadTag
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-tags', organizationId] }),
  })
}

export function useAssignTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: string; tagId: string }) => {
      const { error } = await db.from('lead_tag_assignments').insert({ lead_id: leadId, tag_id: tagId })
      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead', vars.leadId] })
      qc.invalidateQueries({ queryKey: ['lead-timeline', vars.leadId] })
    },
  })
}

export function useRemoveTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: string; tagId: string }) => {
      const { error } = await db.from('lead_tag_assignments').delete()
        .eq('lead_id', leadId).eq('tag_id', tagId)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['lead', vars.leadId] }),
  })
}

// ── Tasks ─────────────────────────────────────────────────────
export interface Task {
  id: string
  organization_id: string
  lead_id: string | null
  assigned_to: string | null
  created_by: string | null
  title: string
  description: string | null
  task_type: string
  status: string
  priority: string
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  profiles?: { full_name: string | null; avatar_url: string | null }
}

export function useLeadTasks(leadId: string | undefined) {
  return useQuery<Task[]>({
    queryKey: ['lead-tasks', leadId],
    queryFn: async () => {
      if (!leadId) return []
      const { data, error } = await db.from('tasks')
        .select('*, profiles:profiles!tasks_assigned_to_fkey(full_name, avatar_url)')
        .eq('lead_id', leadId)
        .order('due_at', { ascending: true })
      if (error) throw error
      return data as Task[]
    },
    enabled: !!leadId,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<Task> & { title: string; lead_id?: string }) => {
      const { data, error } = await db.from('tasks').insert({
        ...values, organization_id: organizationId, created_by: user?.id,
      }).select().single()
      if (error) throw error
      return data as Task
    },
    onSuccess: (_, vars) => {
      if (vars.lead_id) qc.invalidateQueries({ queryKey: ['lead-tasks', vars.lead_id] })
      qc.invalidateQueries({ queryKey: ['tasks', organizationId] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, leadId, ...values }: Partial<Task> & { id: string; leadId?: string }) => {
      const { data, error } = await db.from('tasks').update(values).eq('id', id).select().single()
      if (error) throw error
      return { data: data as Task, leadId }
    },
    onSuccess: ({ leadId }) => {
      if (leadId) qc.invalidateQueries({ queryKey: ['lead-tasks', leadId] })
    },
  })
}

// ── Deals ─────────────────────────────────────────────────────
export interface Deal {
  id: string
  organization_id: string
  lead_id: string
  product_id: string | null
  offer_id: string | null
  stage_id: string | null
  owner_id: string | null
  title: string
  value: number
  currency: string
  status: string
  probability: number
  expected_close: string | null
  closed_at: string | null
  lost_reason: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  products?: { name: string } | null
  pipeline_stages?: { name: string; color: string } | null
  profiles?: { full_name: string | null } | null
}

export function useLeadDeals(leadId: string | undefined) {
  return useQuery<Deal[]>({
    queryKey: ['lead-deals', leadId],
    queryFn: async () => {
      if (!leadId) return []
      const { data, error } = await db.from('deals')
        .select('*, products(name), pipeline_stages(name, color), profiles:profiles!deals_owner_id_fkey(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Deal[]
    },
    enabled: !!leadId,
  })
}

export function useCreateDeal() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<Deal> & { title: string; lead_id: string; value: number }) => {
      const { data, error } = await db.from('deals').insert({
        ...values, organization_id: organizationId, owner_id: values.owner_id ?? user?.id,
      }).select().single()
      if (error) throw error
      // Registra interaction
      await db.from('interactions').insert({
        lead_id: values.lead_id,
        organization_id: organizationId,
        user_id: user?.id,
        type: 'deal',
        content: `Deal criado: ${values.title}`,
        metadata: { deal_value: values.value },
      })
      return data as Deal
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead-deals', vars.lead_id] })
      qc.invalidateQueries({ queryKey: ['lead-timeline', vars.lead_id] })
    },
  })
}

export function useUpdateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, leadId, ...values }: Partial<Deal> & { id: string; leadId: string }) => {
      const { data, error } = await db.from('deals').update(values).eq('id', id).select().single()
      if (error) throw error
      return { data: data as Deal, leadId }
    },
    onSuccess: ({ leadId }) => qc.invalidateQueries({ queryKey: ['lead-deals', leadId] }),
  })
}

// ── Timeline / Interactions ────────────────────────────────────
export interface Interaction {
  id: string
  organization_id: string
  lead_id: string
  user_id: string | null
  type: string
  content: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  profiles?: { full_name: string | null; avatar_url: string | null }
}

export function useLeadTimeline(leadId: string | undefined) {
  return useQuery<Interaction[]>({
    queryKey: ['lead-timeline', leadId],
    queryFn: async () => {
      if (!leadId) return []
      const { data, error } = await db
        .from('interactions')
        .select('*, profiles(full_name, avatar_url)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Interaction[]
    },
    enabled: !!leadId,
  })
}

// ── Stage History ─────────────────────────────────────────────
export interface StageHistory {
  id: string
  lead_id: string
  from_stage_id: string | null
  to_stage_id: string | null
  changed_by: string | null
  note: string | null
  created_at: string
  from_stage?: { name: string; color: string } | null
  to_stage?: { name: string; color: string } | null
  profiles?: { full_name: string | null } | null
}

export function useLeadStageHistory(leadId: string | undefined) {
  return useQuery<StageHistory[]>({
    queryKey: ['lead-stage-history', leadId],
    queryFn: async () => {
      if (!leadId) return []
      const { data, error } = await db
        .from('lead_stage_history')
        .select(`
          *,
          from_stage:pipeline_stages!lead_stage_history_from_stage_id_fkey(name, color),
          to_stage:pipeline_stages!lead_stage_history_to_stage_id_fkey(name, color),
          profiles(full_name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as StageHistory[]
    },
    enabled: !!leadId,
  })
}

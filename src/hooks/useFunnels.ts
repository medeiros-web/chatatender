import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type FunnelStatus = 'draft' | 'active' | 'archived'

export type FunnelBlockType =
  | 'question' | 'schedule' | 'condition' | 'ai_takeover'
  | 'webhook' | 'redirect' | 'statement' | 'capture'

export interface FunnelBlock {
  id: string
  type: FunnelBlockType
  title: string
  description?: string
  options?: { label: string; value: string; next_block_id?: string }[]
  settings?: Record<string, unknown>
  next_block_id?: string
}

export interface CaptureFunnel {
  id: string
  organization_id: string
  product_id: string | null
  name: string
  slug: string
  description: string | null
  status: FunnelStatus
  start_block_id: string | null
  blocks: FunnelBlock[]
  settings: Record<string, unknown>
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export interface FunnelAnalytics {
  total_views: number
  total_completions: number
  conversion_rate: number
}

// ── Funnels ───────────────────────────────────────────────────
export function useFunnels() {
  const { organizationId } = useAuth()
  return useQuery<CaptureFunnel[]>({
    queryKey: ['funnels', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db.from('capture_funnels').select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!organizationId,
  })
}

export function useFunnel(id: string | undefined) {
  const { organizationId } = useAuth()
  return useQuery<CaptureFunnel | null>({
    queryKey: ['funnel', id, organizationId],
    queryFn: async () => {
      if (!id || !organizationId) return null
      const { data } = await db.from('capture_funnels').select('*')
        .eq('id', id).eq('organization_id', organizationId).single()
      return data ?? null
    },
    enabled: !!id && !!organizationId,
  })
}

export function useFunnelBySlug(slug: string | undefined) {
  return useQuery<CaptureFunnel | null>({
    queryKey: ['funnel-public', slug],
    queryFn: async () => {
      if (!slug) return null
      const { data } = await db.from('capture_funnels').select('*')
        .eq('slug', slug).eq('status', 'active').single()
      return data ?? null
    },
    enabled: !!slug,
  })
}

export function useCreateFunnel() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<CaptureFunnel>) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('capture_funnels')
        .insert({ ...values, organization_id: organizationId })
        .select().single()
      if (error) throw error
      return data as CaptureFunnel
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnels', organizationId] }),
  })
}

export function useUpdateFunnel() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<CaptureFunnel> & { id: string }) => {
      const { data, error } = await db.from('capture_funnels')
        .update(values).eq('id', id).eq('organization_id', organizationId).select().single()
      if (error) throw error
      return data as CaptureFunnel
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['funnels', organizationId] })
      qc.invalidateQueries({ queryKey: ['funnel', data.id, organizationId] })
    },
  })
}

export function useDeleteFunnel() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('capture_funnels')
        .delete().eq('id', id).eq('organization_id', organizationId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnels', organizationId] }),
  })
}

export function useFunnelAnalytics(funnelId: string | undefined) {
  const { organizationId } = useAuth()
  return useQuery<FunnelAnalytics>({
    queryKey: ['funnel-analytics', funnelId, organizationId],
    queryFn: async () => {
      if (!funnelId || !organizationId) return { total_views: 0, total_completions: 0, conversion_rate: 0 }
      const { data } = await db.from('funnel_analytics').select('event_type')
        .eq('funnel_id', funnelId).eq('organization_id', organizationId)
      const rows = (data ?? []) as { event_type: string }[]
      const views = rows.filter(r => r.event_type === 'view').length
      const completions = rows.filter(r => r.event_type === 'complete').length
      return {
        total_views: views,
        total_completions: completions,
        conversion_rate: views > 0 ? Math.round((completions / views) * 100) : 0,
      }
    },
    enabled: !!funnelId && !!organizationId,
  })
}

export function useGenerateFunnelAI() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (params: {
      prompt: string
      product_name?: string
      product_id?: string
      funnel_type?: 'quiz' | 'lead_capture' | 'qualification' | 'booking'
    }) => {
      if (!organizationId) throw new Error('No org')
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/funnel-generate-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ ...params, organization_id: organizationId }),
        }
      )
      if (!resp.ok) throw new Error(await resp.text())
      const result = await resp.json()
      return result.funnel as CaptureFunnel
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funnels', organizationId] }),
  })
}

export async function trackFunnelEvent(params: {
  funnelId: string
  organizationId: string
  sessionId: string
  eventType: 'view' | 'click' | 'answer' | 'complete' | 'abandon'
  blockId?: string
  answerValue?: string
  utms?: Record<string, string>
}) {
  await db.from('funnel_analytics').insert({
    funnel_id: params.funnelId,
    organization_id: params.organizationId,
    session_id: params.sessionId,
    event_type: params.eventType,
    block_id: params.blockId ?? null,
    answer_value: params.answerValue ?? null,
    utm_source:   params.utms?.utm_source ?? null,
    utm_medium:   params.utms?.utm_medium ?? null,
    utm_campaign: params.utms?.utm_campaign ?? null,
    utm_content:  params.utms?.utm_content ?? null,
    utm_term:     params.utms?.utm_term ?? null,
    referrer:     typeof window !== 'undefined' ? document.referrer : null,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface KnowledgeSource {
  id: string
  organization_id: string
  product_id: string | null
  type: 'url' | 'pdf' | 'docx' | 'text' | 'sitemap'
  title: string | null
  source_url: string | null
  file_path: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  chunk_count: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeEntry {
  id: string
  organization_id: string
  source_id: string | null
  title: string
  content: string
  chunk_index: number
  token_count: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface TrainingMaterial {
  id: string
  organization_id: string
  agent_id: string | null
  title: string
  content: string
  type: 'text' | 'faq' | 'script' | 'objection'
  created_at: string
}

export interface AIAudit {
  id: string
  organization_id: string
  agent_id: string | null
  conversation_id: string | null
  input_text: string
  output_text: string
  retrieved_chunks: unknown[]
  latency_ms: number | null
  token_input: number | null
  token_output: number | null
  score: number | null
  flagged: boolean
  flag_reason: string | null
  created_at: string
}

// ── Knowledge Sources ─────────────────────────────────────────────────────────

export function useKnowledgeSources() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['knowledge-sources', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_knowledge_sources')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as KnowledgeSource[]
    },
    enabled: !!organizationId,
  })
}

export function useAddKnowledgeSource() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      type: KnowledgeSource['type']
      source_url?: string
      title?: string
      product_id?: string
    }) => {
      const db = supabase as unknown as typeof supabase & { from: typeof supabase.from }
      const { data, error } = await (db as unknown as { from: (t: string) => { insert: (r: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } } } })
        .from('product_knowledge_sources')
        .insert({ organization_id: organizationId!, status: 'pending', ...payload })
        .select()
        .single()
      if (error) throw error
      return data as KnowledgeSource
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-sources', organizationId] }),
  })
}

export function useProcessKnowledgeSource() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (source_id: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-knowledge-source`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ source_id }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-sources', organizationId] }),
  })
}

export function useDeleteKnowledgeSource() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_knowledge_sources')
        .delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-sources', organizationId] }),
  })
}

// ── Knowledge entries ─────────────────────────────────────────────────────────

export function useKnowledgeEntries(sourceId?: string) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['knowledge-entries', organizationId, sourceId],
    queryFn: async () => {
      let q = supabase
        .from('ai_knowledge_base')
        .select('id,title,content,chunk_index,token_count,created_at')
        .eq('organization_id', organizationId!)
      if (sourceId) q = q.eq('source_id', sourceId)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []) as KnowledgeEntry[]
    },
    enabled: !!organizationId,
  })
}

// ── Training Materials ────────────────────────────────────────────────────────

export function useTrainingMaterials(agentId?: string) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['training-materials', organizationId, agentId],
    queryFn: async () => {
      let q = supabase
        .from('agent_training_materials')
        .select('*')
        .eq('organization_id', organizationId!)
      if (agentId) q = q.eq('agent_id', agentId)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TrainingMaterial[]
    },
    enabled: !!organizationId,
  })
}

export function useAddTrainingMaterial() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      agent_id?: string
      title: string
      content: string
      type: TrainingMaterial['type']
    }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-training-material`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organization_id: organizationId!, ...payload }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-materials', organizationId] }),
  })
}

export function useDeleteTrainingMaterial() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agent_training_materials').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-materials', organizationId] }),
  })
}

// ── AI Audits ─────────────────────────────────────────────────────────────────

export function useAIAudits(flaggedOnly = false) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['ai-audits', organizationId, flaggedOnly],
    queryFn: async () => {
      let q = supabase
        .from('ai_audits')
        .select('*')
        .eq('organization_id', organizationId!)
      if (flaggedOnly) q = q.eq('flagged', true)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return (data ?? []) as AIAudit[]
    },
    enabled: !!organizationId,
  })
}

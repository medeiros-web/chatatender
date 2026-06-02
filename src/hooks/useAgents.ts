import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'groq' | 'custom'

// Labels públicos para a UI
export const TOOLS_SCHEMA_LABELS: Record<string, string> = {
  criar_deal: 'Criar negócio', gerar_link_pagamento: 'Link pagamento',
  aplicar_etiqueta: 'Aplicar etiqueta', agendar_followup: 'Agendar follow-up',
  consultar_historico_cliente: 'Histórico cliente', schedule_meeting: 'Agendar reunião',
  check_available_slots: 'Ver horários', switch_to_agent: 'Transferir p/ humano',
  send_catalog_item: 'Enviar catálogo', atualizar_lead: 'Atualizar lead',
  criar_nota: 'Criar nota', buscar_produto: 'Buscar produto',
  calcular_proposta: 'Calcular proposta', verificar_pagamento: 'Verificar pagamento',
  enviar_contrato: 'Enviar contrato', registrar_interesse: 'Registrar interesse',
  obter_depoimentos: 'Obter depoimentos', confirmar_reuniao: 'Confirmar reunião',
}
export type AICapability = 'agent_chat' | 'sales_copilot' | 'audio_transcription' | 'image_vision' | 'embedding' | 'summarization'
export type AgentTone = 'professional' | 'friendly' | 'casual' | 'formal'

export interface ProductAgent {
  id: string
  organization_id: string
  product_id: string
  name: string
  avatar_url: string | null
  persona_description: string | null
  provider: AIProvider
  model: string
  temperature: number
  max_tokens: number
  tone: AgentTone
  language: string
  spin_enabled: boolean
  proactive_scheduling: boolean
  enabled_tools: string[]
  system_prompt_extra: string | null
  business_context: string | null
  objection_handling: string | null
  max_messages_before_handoff: number
  handoff_triggers: string[] | null
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface OrgAICredential {
  id: string
  organization_id: string
  provider: AIProvider
  api_key: string
  api_base_url: string | null
  is_active: boolean
  created_at: string
}

export interface OrgAIRouting {
  id: string
  organization_id: string
  capability: AICapability
  provider: AIProvider
  model: string
  temperature: number
  max_tokens: number
  is_active: boolean
}

export interface AgentSafetyLimits {
  id: string
  organization_id: string
  max_executions_per_day: number
  max_cost_usd_per_day: number
  max_tokens_per_message: number
  max_tool_calls_per_conv: number
  current_day_executions: number
  current_day_cost_usd: number
  last_reset_at: string
  is_paused: boolean
  pause_reason: string | null
}

// ── Product Agents ────────────────────────────────────────────
export function useProductAgent(productId: string | undefined) {
  const { organizationId } = useAuth()
  return useQuery<ProductAgent | null>({
    queryKey: ['agent', productId, organizationId],
    queryFn: async () => {
      if (!productId || !organizationId) return null
      const { data } = await db.from('product_agents').select('*')
        .eq('organization_id', organizationId).eq('product_id', productId).single()
      return data as ProductAgent | null
    },
    enabled: !!productId && !!organizationId,
  })
}

export function useAllAgents() {
  const { organizationId } = useAuth()
  return useQuery<ProductAgent[]>({
    queryKey: ['agents', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db.from('product_agents').select('*, products(name, is_active)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!organizationId,
  })
}

export function useUpsertAgent() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<ProductAgent> & { product_id: string }) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('product_agents')
        .upsert({ ...values, organization_id: organizationId }, { onConflict: 'organization_id,product_id' })
        .select().single()
      if (error) throw error
      return data as ProductAgent
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['agents', organizationId] })
      qc.invalidateQueries({ queryKey: ['agent', vars.product_id, organizationId] })
    },
  })
}

// ── AI Credentials ────────────────────────────────────────────
export function useAICredentials() {
  const { organizationId } = useAuth()
  return useQuery<OrgAICredential[]>({
    queryKey: ['ai-credentials', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data } = await db.from('org_ai_credentials').select('id, organization_id, provider, api_key, api_base_url, is_active, created_at')
        .eq('organization_id', organizationId)
      return data ?? []
    },
    enabled: !!organizationId,
  })
}

export function useUpsertCredential() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: { provider: AIProvider; api_key: string; api_base_url?: string }) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('org_ai_credentials')
        .upsert({ ...values, organization_id: organizationId }, { onConflict: 'organization_id,provider' })
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-credentials', organizationId] }),
  })
}

// ── AI Routing ────────────────────────────────────────────────
export function useAIRouting() {
  const { organizationId } = useAuth()
  return useQuery<OrgAIRouting[]>({
    queryKey: ['ai-routing', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data } = await db.from('org_ai_routing').select('*').eq('organization_id', organizationId)
      return data ?? []
    },
    enabled: !!organizationId,
  })
}

export function useUpdateRouting() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<OrgAIRouting> & { capability: AICapability }) => {
      if (!organizationId) throw new Error('No org')
      const { error } = await db.from('org_ai_routing')
        .upsert({ ...values, organization_id: organizationId }, { onConflict: 'organization_id,capability' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-routing', organizationId] }),
  })
}

// ── Safety Limits ─────────────────────────────────────────────
export function useSafetyLimits() {
  const { organizationId } = useAuth()
  return useQuery<AgentSafetyLimits | null>({
    queryKey: ['safety-limits', organizationId],
    queryFn: async () => {
      if (!organizationId) return null
      const { data } = await db.from('agent_safety_limits').select('*').eq('organization_id', organizationId).single()
      return data as AgentSafetyLimits | null
    },
    enabled: !!organizationId,
    refetchInterval: 60000,
  })
}

export function useUpdateSafetyLimits() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<AgentSafetyLimits>) => {
      if (!organizationId) throw new Error('No org')
      const { error } = await db.from('agent_safety_limits')
        .update(values).eq('organization_id', organizationId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safety-limits', organizationId] }),
  })
}

// ── Agent Action Logs ─────────────────────────────────────────
export function useAgentLogs(limit = 50) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['agent-logs', organizationId, limit],
    queryFn: async () => {
      if (!organizationId) return []
      const { data } = await db.from('agent_action_logs').select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }).limit(limit)
      return data ?? []
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
  })
}

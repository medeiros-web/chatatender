import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type EvolutionProvider = 'evolution_api' | 'evolution_go'
export type InstanceStatus = 'disconnected' | 'connecting' | 'qr_code' | 'connected' | 'error'

export interface EvolutionInstance {
  id: string
  organization_id: string
  instance_name: string
  display_name: string | null
  provider: EvolutionProvider
  server_url: string
  api_key: string
  status: InstanceStatus
  phone_number: string | null
  qr_code_base64: string | null
  qr_code_raw: string | null
  qr_expires_at: string | null
  is_active: boolean
  auto_reply: boolean
  webhook_url: string | null
  last_connected_at: string | null
  last_message_at: string | null
  last_sync_at: string | null
  error_message: string | null
  instance_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ── CRUD de instâncias ────────────────────────────────────────
export function useEvolutionInstances() {
  const { organizationId } = useAuth()
  return useQuery<EvolutionInstance[]>({
    queryKey: ['evolution-instances', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db
        .from('evolution_instances')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as EvolutionInstance[]
    },
    enabled: !!organizationId,
    refetchInterval: 15000, // poll a cada 15s para atualizar status
  })
}

export function useCreateInstance() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async (values: {
      instance_name: string
      display_name?: string
      provider: EvolutionProvider
      server_url: string
      api_key: string
      auto_reply?: boolean
    }) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db
        .from('evolution_instances')
        .insert({ ...values, organization_id: organizationId })
        .select().single()
      if (error) throw error
      return data as EvolutionInstance
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

export function useUpdateInstance() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<EvolutionInstance> & { id: string }) => {
      const { data, error } = await db
        .from('evolution_instances').update(values).eq('id', id).select().single()
      if (error) throw error
      return data as EvolutionInstance
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

export function useDeleteInstance() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('evolution_instances').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

// ── Proxy actions (via Edge Function) ────────────────────────
async function callProxy(instanceId: string, action: string, method = 'GET', body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-proxy?instance_id=${instanceId}&action=${action}`

  const resp = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.error ?? `Proxy error ${resp.status}`)
  return json
}

export function useCreateInstanceOnServer() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (instanceId: string) => {
      return callProxy(instanceId, 'create', 'POST')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

export function useConnectInstance() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (instanceId: string) => {
      // 1. Cria no servidor se não existe
      await callProxy(instanceId, 'create', 'POST').catch(() => { /* já existe */ })
      // 2. Conecta e pega QR
      return callProxy(instanceId, 'qr', 'GET')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

export function useDisconnectInstance() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (instanceId: string) => callProxy(instanceId, 'disconnect', 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

export function useRefreshStatus() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (instanceId: string) => callProxy(instanceId, 'status', 'GET'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

export function useSetWebhook() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (instanceId: string) => callProxy(instanceId, 'set_webhook', 'POST'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evolution-instances', organizationId] }),
  })
}

export function usePollQRCode(instanceId: string | null) {
  const { organizationId } = useAuth()
  return useQuery<EvolutionInstance | null>({
    queryKey: ['qr-poll', instanceId],
    queryFn: async () => {
      if (!instanceId) return null
      // Busca QR atualizado do servidor e atualiza no banco
      await callProxy(instanceId, 'qr', 'GET').catch(() => {})
      // Re-lê do banco
      const { data } = await db.from('evolution_instances').select('*').eq('id', instanceId).single()
      return data as EvolutionInstance
    },
    enabled: !!instanceId,
    refetchInterval: 5000, // poll a cada 5s enquanto aguarda QR
    refetchIntervalInBackground: true,
  })
}

// ── Start WhatsApp conversation ───────────────────────────────
export function useStartWhatsAppConversation() {
  return useMutation({
    mutationFn: async (values: {
      instance_id: string
      phone: string
      initial_message: string
      contact_name?: string
      lead_id?: string
    }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/start-whatsapp-conversation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(values),
        }
      )
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Failed')
      return json as { conversation_id: string; phone: string }
    },
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentProvider = 'cakto' | 'hotmart' | 'doppus' | 'manual'

export interface PaymentIntegration {
  id: string
  organization_id: string
  provider: 'cakto' | 'hotmart' | 'doppus'
  credentials: Record<string, string>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PaymentLink {
  id: string
  organization_id: string
  lead_id: string | null
  product_id: string | null
  created_by_user: string | null
  created_by_agent: string | null
  provider: PaymentProvider
  external_id: string | null
  title: string
  url: string
  amount_cents: number | null
  currency: string
  status: 'active' | 'expired' | 'paid' | 'cancelled'
  expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  leads?: { name: string; email: string | null }
}

export interface PaymentTransaction {
  id: string
  organization_id: string
  payment_link_id: string | null
  lead_id: string | null
  provider: string
  event_type: string
  external_id: string | null
  amount_cents: number | null
  currency: string
  status: 'pending' | 'approved' | 'refunded' | 'chargeback' | 'abandoned'
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  raw_payload: Record<string, unknown>
  processed_at: string | null
  created_at: string
  leads?: { name: string }
}

// ── Integrations (credentials) ────────────────────────────────────────────────

export function usePaymentIntegrations() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['payment_integrations', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payment_integrations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('provider')
      if (error) throw error
      return data as PaymentIntegration[]
    },
  })
}

export function useSavePaymentIntegration() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: {
      provider: 'cakto' | 'hotmart' | 'doppus'
      credentials: Record<string, string>
      is_active?: boolean
    }) => {
      const { error } = await (supabase as any)
        .from('payment_integrations')
        .upsert(
          { ...values, organization_id: organizationId },
          { onConflict: 'organization_id,provider' }
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment_integrations'] }),
  })
}

// ── Payment Links ─────────────────────────────────────────────────────────────

export function usePaymentLinks(leadId?: string) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['payment_links', organizationId, leadId],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('payment_links')
        .select('*, leads(name, email)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (leadId) q = q.eq('lead_id', leadId)
      const { data, error } = await q
      if (error) throw error
      return data as PaymentLink[]
    },
  })
}

export function useCreatePaymentLink() {
  const { organizationId, user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<PaymentLink, 'id' | 'organization_id' | 'created_by_user' | 'created_by_agent' | 'created_at' | 'updated_at' | 'leads'>) => {
      const { data, error } = await (supabase as any)
        .from('payment_links')
        .insert({
          ...values,
          organization_id: organizationId,
          created_by_user: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as PaymentLink
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment_links'] }),
  })
}

export function useUpdatePaymentLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<PaymentLink> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('payment_links')
        .update(values)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment_links'] }),
  })
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function usePaymentTransactions(params?: { leadId?: string; provider?: string }) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['payment_transactions', organizationId, params],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('payment_transactions')
        .select('*, leads(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (params?.leadId)  q = q.eq('lead_id', params.leadId)
      if (params?.provider) q = q.eq('provider', params.provider)
      const { data, error } = await q
      if (error) throw error
      return data as PaymentTransaction[]
    },
  })
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function usePaymentStats() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['payment_stats', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payment_transactions')
        .select('status, amount_cents, provider, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 3600000).toISOString())
      if (error) throw error

      const txs = data as PaymentTransaction[]
      const approved = txs.filter(t => t.status === 'approved')
      const revenue  = approved.reduce((s, t) => s + (t.amount_cents ?? 0), 0)

      return {
        total_transactions: txs.length,
        approved_count: approved.length,
        refunded_count: txs.filter(t => t.status === 'refunded').length,
        abandoned_count: txs.filter(t => t.status === 'abandoned').length,
        revenue_cents: revenue,
        by_provider: ['cakto','hotmart','doppus'].map(p => ({
          provider: p,
          count: txs.filter(t => t.provider === p).length,
          revenue: txs.filter(t => t.provider === p && t.status === 'approved')
            .reduce((s, t) => s + (t.amount_cents ?? 0), 0),
        })),
      }
    },
  })
}

// ── gerar_link_pagamento (called by AI tool) ──────────────────────────────────

export async function gerarLinkPagamento(params: {
  organization_id: string
  lead_id: string
  product_id: string
  provider: PaymentProvider
  title: string
  url: string
  amount_cents?: number
  created_by_agent?: string
}): Promise<PaymentLink> {
  const { data, error } = await (supabase as any)
    .from('payment_links')
    .insert({
      organization_id: params.organization_id,
      lead_id: params.lead_id,
      product_id: params.product_id,
      provider: params.provider,
      title: params.title,
      url: params.url,
      amount_cents: params.amount_cents ?? null,
      created_by_agent: params.created_by_agent ?? null,
      status: 'active',
    })
    .select()
    .single()
  if (error) throw error
  return data as PaymentLink
}

// Webhook URL helpers
export function getWebhookUrl(orgId: string, provider: 'cakto' | 'hotmart' | 'doppus'): string {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (provider === 'cakto')    return `${base}/functions/v1/cakto-webhook?org_id=${orgId}`
  if (provider === 'hotmart')  return `${base}/functions/v1/hotmart-webhook?org_id=${orgId}`
  return `${base}/functions/v1/doppus-webhook?org_id=${orgId}`
}

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Maps a payment event to a lead action:
 * 1. Upsert lead from buyer email/phone
 * 2. Call apply_tag_automations RPC
 * 3. Record the transaction row
 */
export async function processPaymentEvent(
  supabase: SupabaseClient,
  params: {
    organization_id: string
    provider: string
    event_type: string // 'compra_aprovada' | 'checkout_abandonado' | 'reembolso' | 'pix_gerado' | 'boleto_gerado'
    external_id?: string
    amount_cents?: number
    buyer_name?: string
    buyer_email?: string
    buyer_phone?: string
    product_external_id?: string  // provider product/offer id to look up our product
    raw_payload: Record<string, unknown>
  }
): Promise<{ lead_id: string | null; transaction_id: string }> {
  const {
    organization_id, provider, event_type,
    external_id, amount_cents, buyer_name, buyer_email, buyer_phone,
    product_external_id, raw_payload,
  } = params

  // ── 1. Find internal product by external_id stored in payment_links or products metadata
  let product_id: string | null = null
  if (product_external_id) {
    const { data: link } = await supabase
      .from('payment_links')
      .select('product_id')
      .eq('organization_id', organization_id)
      .eq('external_id', product_external_id)
      .maybeSingle()
    if (link?.product_id) product_id = link.product_id
  }

  // ── 2. Upsert lead from buyer data
  let lead_id: string | null = null
  if (buyer_email || buyer_phone) {
    const normalized_phone = buyer_phone ? normalizePhone(buyer_phone) : null

    // Try find existing lead
    let existing: any = null
    if (buyer_email) {
      const { data } = await supabase
        .from('leads')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('email', buyer_email)
        .maybeSingle()
      existing = data
    }
    if (!existing && normalized_phone) {
      const { data } = await supabase
        .from('leads')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('phone', normalized_phone)
        .maybeSingle()
      existing = data
    }

    if (existing) {
      lead_id = existing.id
    } else {
      // Create new lead
      const nameParts = (buyer_name ?? '').split(' ')
      const { data: newLead } = await (supabase as any)
        .from('leads')
        .insert({
          organization_id,
          name: buyer_name ?? buyer_email ?? 'Lead',
          first_name: nameParts[0] ?? null,
          last_name: nameParts.slice(1).join(' ') || null,
          email: buyer_email ?? null,
          phone: normalized_phone,
          source: provider,
        })
        .select('id')
        .single()
      lead_id = newLead?.id ?? null
    }
  }

  // ── 3. Apply tag automations
  if (lead_id && product_id) {
    await supabase.rpc('apply_tag_automations', {
      p_lead_id: lead_id,
      p_event_type: event_type,
      p_product_id: product_id,
      p_org_id: organization_id,
    }).catch(() => {}) // non-fatal
  }

  // ── 4. Map event → transaction status
  const statusMap: Record<string, string> = {
    compra_aprovada: 'approved',
    purchase_approved: 'approved',
    purchase_complete: 'approved',
    reembolso: 'refunded',
    refund: 'refunded',
    purchase_refunded: 'refunded',
    chargeback: 'chargeback',
    checkout_abandonado: 'abandoned',
    abandoned_cart: 'abandoned',
    purchase_canceled: 'abandoned',
    pix_gerado: 'pending',
    boleto_gerado: 'pending',
    purchase_protest: 'chargeback',
  }

  const status = statusMap[event_type] ?? 'pending'

  // ── 5. Record transaction
  const { data: tx } = await (supabase as any)
    .from('payment_transactions')
    .insert({
      organization_id,
      lead_id,
      provider,
      event_type,
      external_id: external_id ?? null,
      amount_cents: amount_cents ?? null,
      status,
      buyer_name: buyer_name ?? null,
      buyer_email: buyer_email ?? null,
      buyer_phone: buyer_phone ?? null,
      raw_payload,
      processed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  // ── 6. Update payment link status if we find it
  if (external_id) {
    const linkStatus = status === 'approved' ? 'paid'
      : status === 'refunded' ? 'cancelled'
      : undefined
    if (linkStatus) {
      await supabase
        .from('payment_links')
        .update({ status: linkStatus })
        .eq('organization_id', organization_id)
        .eq('external_id', external_id)
    }
  }

  return { lead_id, transaction_id: tx?.id ?? '' }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length >= 10) return `55${digits}`
  return digits
}

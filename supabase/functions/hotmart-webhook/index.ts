/**
 * Hotmart Webhook (Postback v2)
 * Validates hottok query param against org credentials.
 * Use per-org webhook URL: .../hotmart-webhook?org_id=<uuid>&hottok=<token>
 *
 * Hotmart event names (PURCHASE_*):
 *   PURCHASE_APPROVED, PURCHASE_CANCELED, PURCHASE_REFUNDED,
 *   PURCHASE_CHARGEBACK, PURCHASE_PROTEST, PURCHASE_COMPLETE,
 *   PURCHASE_BILLET_PRINTED, PURCHASE_OUT_OF_SHOPPING_CART
 *
 * Docs: https://developers.hotmart.com/docs/pt-BR/webhook/
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { processPaymentEvent } from '../_shared/payment-tag-helper.ts'

const CORS = { 'Access-Control-Allow-Origin': '*' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const org_id  = url.searchParams.get('org_id')
  const hottok  = url.searchParams.get('hottok')

  if (!org_id || !hottok) {
    return new Response('missing params', { status: 400 })
  }

  // Validate hottok
  const { data: integration } = await supabase
    .from('payment_integrations')
    .select('credentials')
    .eq('organization_id', org_id)
    .eq('provider', 'hotmart')
    .eq('is_active', true)
    .single()

  const expectedHottok = integration?.credentials?.hottok
  if (!expectedHottok || hottok !== expectedHottok) {
    return new Response('unauthorized', { status: 401 })
  }

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  // Hotmart wraps data in body.data
  const data = body.data ?? body
  const eventType = (body.event ?? '').toUpperCase()

  // Map Hotmart events → internal names
  const eventMap: Record<string, string> = {
    PURCHASE_APPROVED:          'compra_aprovada',
    PURCHASE_COMPLETE:          'compra_aprovada',
    PURCHASE_BILLET_PRINTED:    'boleto_gerado',
    PURCHASE_CANCELED:          'checkout_abandonado',
    PURCHASE_REFUNDED:          'reembolso',
    PURCHASE_CHARGEBACK:        'chargeback',
    PURCHASE_PROTEST:           'chargeback',
    PURCHASE_OUT_OF_SHOPPING_CART: 'checkout_abandonado',
  }

  const event_type = eventMap[eventType] ?? eventType.toLowerCase()

  const buyer   = data.buyer   ?? {}
  const product = data.product ?? {}
  const purchase = data.purchase ?? {}
  const commissions = purchase.price ?? {}

  await processPaymentEvent(supabase, {
    organization_id: org_id,
    provider: 'hotmart',
    event_type,
    external_id: purchase.transaction ?? data.transaction,
    amount_cents: parseCents(commissions.value),
    buyer_name:  buyer.name,
    buyer_email: buyer.email,
    buyer_phone: buyer.phone,
    product_external_id: product.id ?? String(product.ucode ?? ''),
    raw_payload: body,
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

function parseCents(v: unknown): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  if (isNaN(n)) return undefined
  return Math.round(n * 100)
}

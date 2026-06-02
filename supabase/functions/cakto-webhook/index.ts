/**
 * Cakto Webhook
 * Validates X-Cakto-Token (stored per org in payment_integrations.credentials.webhook_token).
 * Supports multi-org: resolves org by product slug in payload or via ?org_id= query param.
 *
 * Cakto event types received in `event` field:
 *   pix_gerado, boleto_gerado, compra_aprovada, checkout_abandonado, reembolso
 *
 * Docs: https://docs.cakto.com.br/webhooks
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

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  // Resolve org_id — via query param (recommended: use per-org webhook URL)
  const url = new URL(req.url)
  const org_id = url.searchParams.get('org_id')
  if (!org_id) {
    return new Response('missing org_id', { status: 400 })
  }

  // Validate token
  const incomingToken = req.headers.get('x-cakto-token') ?? body.token
  const { data: integration } = await supabase
    .from('payment_integrations')
    .select('credentials')
    .eq('organization_id', org_id)
    .eq('provider', 'cakto')
    .eq('is_active', true)
    .single()

  const expectedToken = integration?.credentials?.webhook_token
  if (!expectedToken || incomingToken !== expectedToken) {
    return new Response('unauthorized', { status: 401 })
  }

  // Map Cakto event names → internal names
  const eventMap: Record<string, string> = {
    pix_gerado:           'pix_gerado',
    boleto_gerado:        'boleto_gerado',
    compra_aprovada:      'compra_aprovada',
    checkout_abandonado:  'checkout_abandonado',
    reembolso:            'reembolso',
    purchase_approved:    'compra_aprovada',
    purchase_refunded:    'reembolso',
  }

  const rawEvent = body.event ?? body.type ?? ''
  const event_type = eventMap[rawEvent] ?? rawEvent

  const buyer = body.buyer ?? body.customer ?? {}
  const product = body.product ?? body.checkout ?? {}

  await processPaymentEvent(supabase, {
    organization_id: org_id,
    provider: 'cakto',
    event_type,
    external_id: body.transaction_id ?? body.id,
    amount_cents: parseCents(body.amount ?? body.price),
    buyer_name:  buyer.name ?? buyer.full_name,
    buyer_email: buyer.email,
    buyer_phone: buyer.phone ?? buyer.document_number,
    product_external_id: product.id ?? product.checkout_id,
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
  // Cakto sends values in reais (float), convert to cents
  return Math.round(n * 100)
}

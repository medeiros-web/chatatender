/**
 * Doppus Webhook
 * Validates X-Doppus-Signature (HMAC-SHA256 of body using org's webhook_secret).
 * Use per-org URL: .../doppus-webhook?org_id=<uuid>
 *
 * Doppus event types: sale_approved, sale_refunded, sale_chargeback,
 *   sale_abandoned, billet_generated, pix_generated
 *
 * Docs: https://developers.doppus.com
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
  const org_id = url.searchParams.get('org_id')
  if (!org_id) return new Response('missing org_id', { status: 400 })

  const rawBody = await req.text()
  let body: Record<string, any>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  // Load credentials
  const { data: integration } = await supabase
    .from('payment_integrations')
    .select('credentials')
    .eq('organization_id', org_id)
    .eq('provider', 'doppus')
    .eq('is_active', true)
    .single()

  if (!integration) return new Response('not configured', { status: 400 })

  // Validate HMAC-SHA256 signature
  const secret = integration.credentials?.webhook_secret
  if (secret) {
    const signature = req.headers.get('x-doppus-signature') ?? req.headers.get('x-signature')
    const valid = await verifyHmac(secret, rawBody, signature ?? '')
    if (!valid) return new Response('unauthorized', { status: 401 })
  }

  // Map Doppus events → internal names
  const eventMap: Record<string, string> = {
    sale_approved:   'compra_aprovada',
    sale_refunded:   'reembolso',
    sale_chargeback: 'chargeback',
    sale_abandoned:  'checkout_abandonado',
    sale_canceled:   'checkout_abandonado',
    billet_generated:'boleto_gerado',
    pix_generated:   'pix_gerado',
  }

  const rawEvent  = body.event ?? body.type ?? ''
  const event_type = eventMap[rawEvent] ?? rawEvent

  const customer = body.customer ?? body.buyer ?? {}
  const product  = body.product  ?? {}
  const sale     = body.sale     ?? {}

  await processPaymentEvent(supabase, {
    organization_id: org_id,
    provider: 'doppus',
    event_type,
    external_id: sale.id ?? body.transaction_id,
    amount_cents: parseCents(sale.amount ?? body.amount),
    buyer_name:  customer.name ?? customer.full_name,
    buyer_email: customer.email,
    buyer_phone: customer.phone ?? customer.cellphone,
    product_external_id: product.id,
    raw_payload: body,
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

async function verifyHmac(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
    return hex === signature.replace(/^sha256=/, '')
  } catch {
    return false
  }
}

function parseCents(v: unknown): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  if (isNaN(n)) return undefined
  return Math.round(n * 100)
}

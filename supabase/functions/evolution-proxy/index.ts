import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const JSON_H = { 'Content-Type': 'application/json' }

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_H })
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_H })
}

// ── Helpers Evolution API ────────────────────────────────────
function evoHeaders(apiKey: string) {
  return { 'Content-Type': 'application/json', 'apikey': apiKey }
}

async function evoFetch(serverUrl: string, path: string, method: string, apiKey: string, body?: unknown) {
  const resp = await fetch(`${serverUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: evoHeaders(apiKey),
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: unknown
  try { data = await resp.json() } catch { data = {} }
  return { ok: resp.ok, status: resp.status, data }
}

// ── Handlers por action ──────────────────────────────────────
async function actionCreate(inst: Record<string, string>) {
  const res = await evoFetch(inst.server_url, `/instance/create`, 'POST', inst.api_key, {
    instanceName: inst.instance_name,
    integration: 'WHATSAPP-BAILEYS',
  })
  if (!res.ok && res.status !== 409) {  // 409 = já existe, tudo bem
    await supabase.from('evolution_instances')
      .update({ error_message: `Erro ao criar no servidor: ${JSON.stringify(res.data)}`, status: 'error' })
      .eq('id', inst.id)
  } else {
    await supabase.from('evolution_instances')
      .update({ error_message: null, status: 'disconnected', last_sync_at: new Date().toISOString() })
      .eq('id', inst.id)
  }
  return res.data
}

async function actionQR(inst: Record<string, string>) {
  const res = await evoFetch(inst.server_url, `/instance/connect/${inst.instance_name}`, 'GET', inst.api_key)
  const d = res.data as Record<string, unknown>

  const qrB64 = (d?.base64 as string)?.replace(/^data:image\/png;base64,/, '') ?? null
  const qrRaw = (d?.code as string) ?? null

  await supabase.from('evolution_instances').update({
    qr_code_base64: qrB64,
    qr_code_raw: qrRaw,
    qr_expires_at: qrB64 ? new Date(Date.now() + 60_000).toISOString() : null,
    status: qrB64 ? 'qr_code' : 'connecting',
    error_message: null,
    last_sync_at: new Date().toISOString(),
  }).eq('id', inst.id)

  return d
}

async function actionStatus(inst: Record<string, string>) {
  const res = await evoFetch(inst.server_url, `/instance/connectionState/${inst.instance_name}`, 'GET', inst.api_key)
  const d = res.data as Record<string, unknown>
  const state = (d?.instance as Record<string, unknown>)?.state as string ?? 'unknown'

  const statusMap: Record<string, string> = {
    open: 'connected',
    connecting: 'connecting',
    close: 'disconnected',
    qr: 'qr_code',
  }
  const newStatus = statusMap[state] ?? 'disconnected'

  const update: Record<string, unknown> = {
    status: newStatus,
    last_sync_at: new Date().toISOString(),
  }
  if (newStatus === 'connected') {
    update.last_connected_at = new Date().toISOString()
    update.qr_code_base64 = null
    update.qr_code_raw = null
    update.error_message = null
  }

  await supabase.from('evolution_instances').update(update).eq('id', inst.id)
  return { status: newStatus, raw: d }
}

async function actionSetWebhook(inst: Record<string, string>, webhookUrl: string) {
  const res = await evoFetch(
    inst.server_url,
    `/webhook/set/${inst.instance_name}`,
    'POST',
    inst.api_key,
    {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'messages.upsert', 'messages.update',
        'connection.update', 'qrcode.updated',
      ],
    }
  )
  if (res.ok) {
    await supabase.from('evolution_instances')
      .update({ webhook_url: webhookUrl, last_sync_at: new Date().toISOString() })
      .eq('id', inst.id)
  }
  return res.data
}

async function actionDisconnect(inst: Record<string, string>) {
  const res = await evoFetch(inst.server_url, `/instance/logout/${inst.instance_name}`, 'DELETE', inst.api_key)
  await supabase.from('evolution_instances').update({
    status: 'disconnected',
    phone_number: null,
    qr_code_base64: null,
    qr_code_raw: null,
    last_sync_at: new Date().toISOString(),
  }).eq('id', inst.id)
  return res.data
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const instanceId = url.searchParams.get('instance_id')
    const action = url.searchParams.get('action')

    if (!instanceId || !action) return err('instance_id and action are required')

    const { data: inst } = await supabase
      .from('evolution_instances')
      .select('id, instance_name, server_url, api_key, organization_id, provider')
      .eq('id', instanceId)
      .single()

    if (!inst) return err('Instance not found', 404)

    const i = inst as Record<string, string>

    const webhookBase = Deno.env.get('SUPABASE_URL')
    const webhookUrl = `${webhookBase}/functions/v1/evolution-webhook?provider=${i.provider}`

    switch (action) {
      case 'create':    return ok(await actionCreate(i))
      case 'qr':        return ok(await actionQR(i))
      case 'status':    return ok(await actionStatus(i))
      case 'set_webhook': return ok(await actionSetWebhook(i, webhookUrl))
      case 'disconnect':  return ok(await actionDisconnect(i))
      default: return err(`Unknown action: ${action}`)
    }
  } catch (e) {
    console.error('evolution-proxy error:', e)
    return err(String(e), 500)
  }
})

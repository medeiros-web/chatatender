import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function normalizeBrPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return '55' + digits
}

async function upsertContact(orgId: string, phone: string, name?: string) {
  const { data } = await supabase
    .from('leads')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('phone', phone)
    .single()
  if (data) return data as { id: string; name: string }
  const { data: created } = await supabase
    .from('leads')
    .insert({ organization_id: orgId, phone, name: name ?? phone, source: 'whatsapp', status: 'new' })
    .select('id, name').single()
  return created as { id: string; name: string }
}

async function upsertConversation(orgId: string, instanceId: string, phone: string, leadId: string, productId?: string) {
  const { data: existing } = await supabase
    .from('webchat_conversations')
    .select('id, status, assigned_user_id, current_agent_id')
    .eq('organization_id', orgId)
    .eq('whatsapp_instance_id', instanceId)
    .eq('contact_phone', phone)
    .in('status', ['open', 'waiting_human', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) return existing as Record<string, unknown>

  const { data: created } = await supabase
    .from('webchat_conversations')
    .insert({
      organization_id: orgId,
      whatsapp_instance_id: instanceId,
      contact_phone: phone,
      contact_external_id: phone,
      channel: 'whatsapp',
      status: 'open',
      lead_id: leadId,
      product_id: productId ?? null,
    })
    .select('id, status, assigned_user_id, current_agent_id')
    .single()
  return created as Record<string, unknown>
}

async function scheduleBot(conversationId: string): Promise<void> {
  // Debounce 4s via process_after
  await supabase.from('whatsapp_message_queue').upsert({
    conversation_id: conversationId,
    process_after: new Date(Date.now() + 4000).toISOString(),
    status: 'pending',
  }, { onConflict: 'conversation_id', ignoreDuplicates: false })
}

async function callBotNow(conversationId: string): Promise<void> {
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/webchat-bot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ conversation_id: conversationId }),
  })
}

// ── Handler Evolution API ─────────────────────────────────────
async function handleEvolutionAPI(body: Record<string, unknown>, instanceRecord: Record<string, unknown>) {
  const event = body.event as string
  if (event !== 'messages.upsert') return { ok: true, skipped: event }

  const msg = (body.data as Record<string, unknown>)
  const key = msg?.key as Record<string, unknown>
  if (!key || key.fromMe) return { ok: true, skipped: 'own_message' }

  const remoteJid = key.remoteJid as string
  const phone = normalizeBrPhone(remoteJid.replace('@s.whatsapp.net', ''))
  const pushName = msg.pushName as string | undefined
  const msgObj = msg.message as Record<string, unknown> | null
  const text = (msgObj?.conversation as string)
    ?? (msgObj?.extendedTextMessage as Record<string, unknown>)?.text as string
    ?? ''
  const messageType = msgObj?.imageMessage ? 'image'
    : msgObj?.audioMessage ? 'audio'
    : msgObj?.documentMessage ? 'document'
    : 'text'

  const orgId = instanceRecord.organization_id as string
  const instanceId = instanceRecord.id as string

  const lead = await upsertContact(orgId, phone, pushName)
  const conv = await upsertConversation(orgId, instanceId, phone, lead.id)
  const convId = conv.id as string

  await supabase.from('webchat_messages').insert({
    conversation_id: convId,
    organization_id: orgId,
    is_from_contact: true,
    message_type: messageType,
    direction: 'inbound',
    content: text || null,
    is_sent: true,
    sent_at: new Date().toISOString(),
    metadata: { raw: key },
  })

  await supabase.from('webchat_conversations')
    .update({ last_message_at: new Date().toISOString(), unread_count: (conv.unread_count as number ?? 0) + 1 })
    .eq('id', convId)

  // Só chama IA se não há humano na conversa
  const hasHuman = conv.assigned_user_id || conv.status === 'in_progress' || conv.status === 'closed'
  if (!hasHuman) {
    await scheduleBot(convId)
    // Dispara bot após 4s (fire and forget — o cron/pg_cron processa a queue)
    // Para ambientes sem pg_cron, chama diretamente com delay
    setTimeout(() => callBotNow(convId), 4100)
  }

  return { ok: true, conversation_id: convId }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

Deno.serve(async (req: Request) => {
  // CORS preflight — status 204 must have null body
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const url = new URL(req.url)
    const provider = url.searchParams.get('provider') ?? 'evolution_api'

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400)
    }

    // Identifica instância pela instance key no body
    const instanceName = (body.instance as string)
      ?? (body.data as Record<string, unknown>)?.instance as string
      ?? ''

    const { data: instanceRecord } = await supabase
      .from('evolution_instances')
      .select('id, organization_id, name, product_id')
      .eq('instance_name', instanceName)
      .single()

    if (!instanceRecord) {
      console.warn(`evolution-webhook: instância '${instanceName}' não encontrada`)
      return jsonResponse({ ok: true, warn: 'instance_not_found' })
    }

    let result: Record<string, unknown>
    if (provider === 'evolution_api' || provider === 'evolution_go') {
      result = await handleEvolutionAPI(body, instanceRecord as Record<string, unknown>)
    } else {
      result = { ok: false, error: `provider '${provider}' not supported` }
    }

    return jsonResponse(result)
  } catch (err) {
    console.error('evolution-webhook unhandled error:', err)
    return jsonResponse({ ok: false, error: String(err) }, 500)
  }
})

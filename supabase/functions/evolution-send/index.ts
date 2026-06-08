import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function chunk(text: string, maxLen = 500): string[] {
  if (text.length <= maxLen) return [text]
  const mid = Math.ceil(text.length / 2)
  const split = text.lastIndexOf(' ', mid) || mid
  return [text.slice(0, split).trim(), text.slice(split).trim()]
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

const JSON_H = { 'Content-Type': 'application/json' }
function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_H })
}

Deno.serve(async (req: Request) => {
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

  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  let body: { instance_id: string; phone: string; text: string; conversation_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonRes({ error: 'Invalid JSON' }, 400)
  }

  try {
    const { instance_id, phone, text, conversation_id } = body

    if (!instance_id || !phone || !text) {
      return jsonRes({ error: 'instance_id, phone and text are required' }, 400)
    }

    const { data: instance } = await supabase
      .from('evolution_instances')
      .select('server_url, api_key, instance_name, organization_id')
      .eq('id', instance_id)
      .single()

    if (!instance) return jsonRes({ error: 'Instance not found' }, 404)

    const serverUrl = (instance as Record<string, unknown>).server_url as string
    const apiKey    = (instance as Record<string, unknown>).api_key as string
    const instName  = (instance as Record<string, unknown>).instance_name as string
    const orgId     = (instance as Record<string, unknown>).organization_id as string

    const parts = chunk(text, 500)
    const results: unknown[] = []

    for (let i = 0; i < parts.length; i++) {
      if (i > 0) await sleep(800)

      const resp = await fetch(`${serverUrl}/message/sendText/${instName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({ number: phone, text: parts[i], delay: 1000 }),
      })
      let data: unknown
      try { data = await resp.json() } catch { data = {} }
      results.push(data)

      if (conversation_id) {
        await supabase.from('webchat_messages').insert({
          conversation_id,
          organization_id: orgId,
          is_from_contact: false,
          message_type: 'text',
          direction: 'outbound',
          content: parts[i],
          is_sent: resp.ok,
          sent_at: new Date().toISOString(),
          metadata: { evolution_response: data, part: i + 1, total: parts.length },
        })
      }
    }

    return jsonRes({ ok: true, parts: parts.length, results })
  } catch (e) {
    console.error('evolution-send error:', e)
    return jsonRes({ ok: false, error: String(e) }, 500)
  }
})

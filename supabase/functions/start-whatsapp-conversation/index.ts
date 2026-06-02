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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await req.json() as {
    lead_id: string
    phone: string
    instance_id: string
    initial_message?: string
    product_id?: string
    organization_id: string
  }

  const { lead_id, phone, instance_id, initial_message, product_id, organization_id } = body
  if (!lead_id || !phone || !instance_id || !organization_id) {
    return new Response(JSON.stringify({ error: 'lead_id, phone, instance_id, organization_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const normalizedPhone = normalizeBrPhone(phone)

  // Verifica conversa ativa existente
  const { data: existing } = await supabase
    .from('webchat_conversations')
    .select('id')
    .eq('organization_id', organization_id)
    .eq('whatsapp_instance_id', instance_id)
    .eq('contact_phone', normalizedPhone)
    .in('status', ['open', 'waiting_human', 'in_progress'])
    .single()

  let conversationId: string

  if (existing) {
    conversationId = (existing as Record<string, unknown>).id as string
  } else {
    const { data: conv, error } = await supabase
      .from('webchat_conversations')
      .insert({
        organization_id,
        whatsapp_instance_id: instance_id,
        contact_phone: normalizedPhone,
        contact_external_id: normalizedPhone,
        channel: 'whatsapp',
        status: 'open',
        lead_id,
        product_id: product_id ?? null,
      })
      .select('id')
      .single()
    if (error) throw error
    conversationId = (conv as Record<string, unknown>).id as string
  }

  // Envia mensagem inicial
  if (initial_message) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        instance_id,
        phone: normalizedPhone,
        text: initial_message,
        conversation_id: conversationId,
      }),
    })
  }

  return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

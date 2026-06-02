import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildSystemPrompt } from './spin-persona.ts'
import { TOOLS_SCHEMA, executeTool } from './tools-registry.ts'
import { resolveAIProvider, callAI } from './ai-router.ts'
import { checkSafetyLimits, recordUsage } from './safety.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Filtro de similaridade (anti-loop)
function tokenOverlap(a: string, b: string): number {
  if (!a || !b) return 0
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 3))
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 3))
  if (ta.size === 0 || tb.size === 0) return 0
  const inter = [...ta].filter(t => tb.has(t)).length
  return inter / Math.max(ta.size, tb.size)
}

// Anti-hallucination: marcadores de agendamento sem tool
const BOOKING_MARKERS = [
  'reunião agendada', 'horário confirmado', 'agendei para', 'marcamos para',
  'confirmo seu agendamento', 'já agendei', 'fica confirmado',
]

function hasBookingHallucination(text: string, executedTools: string[]): boolean {
  const lower = text.toLowerCase()
  return BOOKING_MARKERS.some(m => lower.includes(m)) && !executedTools.includes('schedule_meeting')
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await req.json() as {
    conversation_id: string
    force?: boolean
  }

  const { conversation_id, force = false } = body
  if (!conversation_id) {
    return new Response(JSON.stringify({ error: 'conversation_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 1. Carrega conversa
  const { data: conv, error: convErr } = await supabase
    .from('webchat_conversations')
    .select('*')
    .eq('id', conversation_id)
    .single()

  if (convErr || !conv) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 2. Verifica se humano assumiu
  if (!force && (conv.assigned_user_id || conv.status === 'in_progress' || conv.status === 'closed')) {
    return new Response(JSON.stringify({ ok: true, skipped: 'human_in_charge' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const orgId = conv.organization_id as string

  // 3. Safety limits
  const safetyCheck = await checkSafetyLimits(supabase, orgId)
  if (!safetyCheck.allowed) {
    return new Response(JSON.stringify({ ok: false, error: safetyCheck.reason }), {
      status: 429, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 4. Resolve agente
  const { data: agent } = await supabase
    .from('product_agents')
    .select('*')
    .eq('organization_id', orgId)
    .eq('product_id', conv.product_id)
    .eq('is_active', true)
    .single()

  // 5. Histórico de mensagens (últimas 20)
  const { data: messages = [] } = await supabase
    .from('webchat_messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .eq('is_deleted', false)
    .neq('message_type', 'system')
    .order('created_at', { ascending: true })
    .limit(20)

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_messages' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // 6. Lead
  const { data: lead } = conv.lead_id
    ? await supabase.from('leads').select('*').eq('id', conv.lead_id).single()
    : { data: null }

  // 7. Config de IA
  const aiConfig = await resolveAIProvider(supabase, orgId, 'agent_chat', agent as Record<string, unknown> | null)

  // 8. Mensagens no formato da IA
  const aiMessages: Record<string, unknown>[] = (messages as Record<string, unknown>[]).map(m => ({
    role: m.is_from_contact ? 'user' : 'assistant',
    content: (m.content as string) || '[mídia]',
  }))

  // 9. System prompt SPIN
  const systemPrompt = buildSystemPrompt({
    agent: agent as Record<string, unknown> | null,
    lead: lead as Record<string, unknown> | null,
    conv: conv as Record<string, unknown>,
  })

  // 10. Ferramentas habilitadas
  const defaultTools = ['switch_to_agent', 'criar_nota', 'registrar_interesse', 'check_available_slots', 'schedule_meeting', 'agendar_followup']
  const enabledTools: string[] = (agent as Record<string, unknown> | null)?.enabled_tools as string[] ?? defaultTools
  const activeTools = TOOLS_SCHEMA.filter(t => enabledTools.includes(t.name))

  // 11. Loop de tool calls (max 5 rounds)
  let finalText = ''
  const executedTools: string[] = []
  let currentMessages = [...aiMessages]
  const MAX_ROUNDS = 5

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const aiResp = await callAI(aiConfig, systemPrompt, currentMessages, activeTools)
    const stopReason = aiResp.stop_reason as string

    await recordUsage(
      supabase, orgId,
      (aiResp.usage as Record<string, unknown>)?.input_tokens as number ?? 0,
      (aiResp.usage as Record<string, unknown>)?.output_tokens as number ?? 0,
      aiConfig.model
    )

    if (stopReason === 'tool_use' || stopReason === 'tool_calls') {
      const toolUses = (aiResp.content as Record<string, unknown>[])?.filter(c => c.type === 'tool_use') ?? []
      const toolResults: Record<string, unknown>[] = []

      for (const toolUse of toolUses) {
        const toolName = toolUse.name as string
        const toolInput = toolUse.input as Record<string, unknown>

        let toolOutput: unknown
        let toolSuccess = true
        let toolError = ''

        try {
          toolOutput = await executeTool(supabase, toolName, toolInput, {
            conv: conv as Record<string, unknown>,
            lead: lead as Record<string, unknown> | null,
            orgId,
          })
          executedTools.push(toolName)
        } catch (e) {
          toolSuccess = false
          toolError = String(e)
          toolOutput = { error: toolError }
        }

        await supabase.from('agent_tool_executions').insert({
          organization_id: orgId,
          conversation_id,
          lead_id: conv.lead_id,
          tool_name: toolName,
          tool_input: toolInput,
          tool_output: toolOutput,
          success: toolSuccess,
          error_message: toolError || null,
        })

        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolOutput) })

        // Handoff imediato
        if (toolName === 'switch_to_agent') {
          return new Response(JSON.stringify({ ok: true, action: 'handoff' }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: aiResp.content },
        { role: 'user', content: toolResults },
      ]
    } else {
      const textBlock = (aiResp.content as Record<string, unknown>[])?.find(c => c.type === 'text')
      finalText = (textBlock?.text as string) ?? ''
      break
    }
  }

  if (!finalText) {
    return new Response(JSON.stringify({ ok: false, error: 'No response generated' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 12. Anti-hallucination
  if (hasBookingHallucination(finalText, executedTools)) {
    const corrResp = await callAI(aiConfig, systemPrompt, [
      ...currentMessages,
      { role: 'assistant', content: [{ type: 'text', text: finalText }] },
      { role: 'user', content: [{ type: 'text', text: 'Não confirme agendamentos sem usar a ferramenta. Ofereça os horários mas aguarde confirmação.' }] },
    ], [])
    const tb = (corrResp.content as Record<string, unknown>[])?.find(c => c.type === 'text')
    finalText = (tb?.text as string) ?? finalText
  }

  // 13. Filtro similaridade (anti-loop, overlap >= 80%)
  const recentOut = (messages as Record<string, unknown>[])
    .filter(m => !m.is_from_contact && m.content)
    .slice(-4)
    .map(m => m.content as string)

  if (recentOut.some(t => tokenOverlap(finalText, t) >= 0.8)) {
    const varResp = await callAI(aiConfig, systemPrompt, [
      ...currentMessages,
      { role: 'assistant', content: [{ type: 'text', text: finalText }] },
      { role: 'user', content: [{ type: 'text', text: 'Varie sua abordagem. Use outra pergunta SPIN ou um ângulo diferente.' }] },
    ], [])
    const tb = (varResp.content as Record<string, unknown>[])?.find(c => c.type === 'text')
    finalText = (tb?.text as string) ?? finalText
  }

  // 14. Envia resposta
  if (conv.channel === 'whatsapp' && conv.whatsapp_instance_id) {
    const phone = conv.contact_external_id || conv.contact_phone
    if (phone) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          instance_id: conv.whatsapp_instance_id,
          phone,
          text: finalText,
          conversation_id,
        }),
      })
    }
  } else {
    await supabase.from('webchat_messages').insert({
      conversation_id,
      organization_id: orgId,
      is_from_contact: false,
      message_type: 'text',
      direction: 'outbound',
      content: finalText,
      is_sent: true,
      sent_at: new Date().toISOString(),
      metadata: { ai_generated: true, model: aiConfig.model, tools: executedTools },
    })
  }

  // 15. Log
  await supabase.from('agent_action_logs').insert({
    organization_id: orgId,
    agent_id: (agent as Record<string, unknown> | null)?.id ?? null,
    conversation_id,
    lead_id: conv.lead_id,
    action_type: 'message',
    ai_model: aiConfig.model,
    success: true,
    metadata: { executed_tools: executedTools },
  })

  return new Response(JSON.stringify({ ok: true, response: finalText, tools_used: executedTools }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

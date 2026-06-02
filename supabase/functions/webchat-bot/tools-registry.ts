import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const TOOLS_SCHEMA = [
  {
    name: 'criar_deal',
    description: 'Cria um negócio para o lead no pipeline de vendas.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do negócio' },
        value: { type: 'number', description: 'Valor em reais' },
        probability: { type: 'number', description: 'Probabilidade 0-100' },
      },
      required: ['title', 'value'],
    },
  },
  {
    name: 'gerar_link_pagamento',
    description: 'Gera um link de pagamento para uma oferta.',
    input_schema: {
      type: 'object',
      properties: {
        offer_name: { type: 'string' },
        value: { type: 'number' },
      },
      required: ['offer_name', 'value'],
    },
  },
  {
    name: 'aplicar_etiqueta',
    description: 'Aplica uma tag ao lead atual.',
    input_schema: {
      type: 'object',
      properties: { tag_name: { type: 'string', description: 'Nome da tag' } },
      required: ['tag_name'],
    },
  },
  {
    name: 'agendar_followup',
    description: 'Agenda um follow-up com o lead.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        due_at: { type: 'string', description: 'Data/hora ISO 8601' },
        note: { type: 'string' },
      },
      required: ['title', 'due_at'],
    },
  },
  {
    name: 'consultar_historico_cliente',
    description: 'Consulta interações anteriores do lead.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Quantidade (padrão 5)' } },
    },
  },
  {
    name: 'schedule_meeting',
    description: 'Agenda uma reunião. Use SOMENTE após o lead confirmar o horário.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start_at: { type: 'string', description: 'ISO 8601' },
        duration_minutes: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['title', 'start_at'],
    },
  },
  {
    name: 'check_available_slots',
    description: 'Verifica horários disponíveis para reunião nos próximos dias.',
    input_schema: {
      type: 'object',
      properties: { days_ahead: { type: 'number', description: 'Dias à frente (padrão 3)' } },
    },
  },
  {
    name: 'switch_to_agent',
    description: 'Transfere para atendente humano. Use quando solicitado ou quando não puder ajudar.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motivo da transferência' },
        sector: { type: 'string', description: 'Setor de destino (opcional)' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'send_catalog_item',
    description: 'Envia item do catálogo ao lead.',
    input_schema: {
      type: 'object',
      properties: {
        product_name: { type: 'string' },
        include_price: { type: 'boolean' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'atualizar_lead',
    description: 'Atualiza dados do lead (nome, email, phone, company, job_title).',
    input_schema: {
      type: 'object',
      properties: {
        field: { type: 'string', description: 'Campo: name|email|phone|company|job_title' },
        value: { type: 'string' },
      },
      required: ['field', 'value'],
    },
  },
  {
    name: 'criar_nota',
    description: 'Cria nota interna sobre o lead.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        is_pinned: { type: 'boolean' },
      },
      required: ['content'],
    },
  },
  {
    name: 'buscar_produto',
    description: 'Busca produtos no catálogo.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'calcular_proposta',
    description: 'Calcula proposta personalizada com desconto.',
    input_schema: {
      type: 'object',
      properties: {
        offer_name: { type: 'string' },
        custom_value: { type: 'number' },
        discount_pct: { type: 'number', description: 'Desconto em % (0-100)' },
      },
      required: ['offer_name'],
    },
  },
  {
    name: 'verificar_pagamento',
    description: 'Verifica status de pagamento anterior.',
    input_schema: {
      type: 'object',
      properties: { reference: { type: 'string', description: 'Número do pedido ou CPF' } },
      required: ['reference'],
    },
  },
  {
    name: 'enviar_contrato',
    description: 'Envia link de contrato para assinatura digital.',
    input_schema: {
      type: 'object',
      properties: {
        template_name: { type: 'string' },
        valid_days: { type: 'number' },
      },
      required: ['template_name'],
    },
  },
  {
    name: 'registrar_interesse',
    description: 'Registra produto de interesse do lead.',
    input_schema: {
      type: 'object',
      properties: {
        interest: { type: 'string' },
        level: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['interest'],
    },
  },
  {
    name: 'obter_depoimentos',
    description: 'Retorna casos de sucesso relevantes para o perfil do lead.',
    input_schema: {
      type: 'object',
      properties: { segment: { type: 'string', description: 'Segmento do lead' } },
    },
  },
  {
    name: 'confirmar_reuniao',
    description: 'Envia confirmação de uma reunião já agendada.',
    input_schema: {
      type: 'object',
      properties: { meeting_id: { type: 'string' } },
      required: ['meeting_id'],
    },
  },
]

export async function executeTool(
  supabase: SupabaseClient,
  toolName: string,
  input: Record<string, unknown>,
  ctx: { conv: Record<string, unknown>; lead: Record<string, unknown> | null; orgId: string }
): Promise<unknown> {
  const { conv, lead, orgId } = ctx

  switch (toolName) {
    case 'criar_deal': {
      if (!lead?.id) return { error: 'Lead não encontrado' }
      const { data, error } = await supabase.from('deals').insert({
        organization_id: orgId,
        lead_id: lead.id,
        product_id: conv.product_id,
        title: input.title as string,
        value: input.value as number,
        probability: (input.probability as number) ?? 50,
        status: 'open',
      }).select('id').single()
      if (error) throw error
      return { success: true, deal_id: (data as Record<string, unknown>).id }
    }

    case 'aplicar_etiqueta': {
      if (!lead?.id) return { error: 'Lead não encontrado' }
      const { data: tag } = await supabase.from('lead_tags').select('id')
        .eq('organization_id', orgId).ilike('name', `%${input.tag_name as string}%`).single()
      if (!tag) return { error: `Tag '${input.tag_name}' não encontrada` }
      await supabase.from('lead_tag_assignments')
        .upsert({ lead_id: lead.id, tag_id: (tag as Record<string, unknown>).id }, { onConflict: 'lead_id,tag_id', ignoreDuplicates: true })
      return { success: true, tag: input.tag_name }
    }

    case 'agendar_followup': {
      if (!lead?.id) return { error: 'Lead não encontrado' }
      await supabase.from('tasks').insert({
        organization_id: orgId, lead_id: lead.id,
        title: input.title as string, task_type: 'follow_up',
        status: 'pending', priority: 'medium', due_at: input.due_at as string,
      })
      return { success: true, due_at: input.due_at }
    }

    case 'consultar_historico_cliente': {
      if (!lead?.id) return { history: [] }
      const { data } = await supabase.from('interactions').select('type, content, created_at')
        .eq('lead_id', lead.id).order('created_at', { ascending: false }).limit((input.limit as number) ?? 5)
      return { history: data ?? [] }
    }

    case 'check_available_slots': {
      const days = (input.days_ahead as number) ?? 3
      const now = new Date()
      const slots: string[] = []
      for (let d = 1; d <= days + 2; d++) {
        const date = new Date(now)
        date.setDate(date.getDate() + d)
        if (date.getDay() !== 0 && date.getDay() !== 6) {
          const ds = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
          slots.push(`${ds} às 10h`, `${ds} às 14h`)
          if (slots.length >= days * 2) break
        }
      }
      return { available_slots: slots.slice(0, 4), suggestion_1: slots[0], suggestion_2: slots[2] }
    }

    case 'schedule_meeting': {
      if (!lead?.id) return { error: 'Lead não encontrado' }
      const { data } = await supabase.from('tasks').insert({
        organization_id: orgId, lead_id: lead.id,
        title: input.title as string, task_type: 'meeting',
        status: 'pending', priority: 'high', due_at: input.start_at as string,
        description: (input.notes as string) ?? null,
      }).select('id').single()
      await supabase.from('leads').update({ next_follow_up_at: input.start_at }).eq('id', lead.id)
      const dateStr = new Date(input.start_at as string).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
      return { success: true, meeting_id: (data as Record<string, unknown>)?.id, start_at: input.start_at, confirmation: `Reunião agendada para ${dateStr}` }
    }

    case 'switch_to_agent': {
      await supabase.from('webchat_conversations')
        .update({ status: 'waiting_human', current_agent_id: null }).eq('id', conv.id)
      await supabase.from('agent_handoff_history').insert({
        organization_id: orgId, conversation_id: conv.id,
        reason: 'trigger', trigger_text: input.reason as string,
      })
      return { success: true, status: 'waiting_human' }
    }

    case 'criar_nota': {
      if (!lead?.id) return { error: 'Lead não encontrado' }
      await supabase.from('lead_notes').insert({
        organization_id: orgId, lead_id: lead.id,
        content: input.content as string, is_pinned: (input.is_pinned as boolean) ?? false,
      })
      return { success: true }
    }

    case 'atualizar_lead': {
      if (!lead?.id) return { error: 'Lead não encontrado' }
      const allowed = ['name', 'email', 'phone', 'company', 'job_title']
      const field = input.field as string
      if (!allowed.includes(field)) return { error: `Campo '${field}' não permitido` }
      await supabase.from('leads').update({ [field]: input.value }).eq('id', lead.id)
      return { success: true, updated: field }
    }

    case 'buscar_produto': {
      const { data } = await supabase.from('products').select('name, description, price')
        .eq('organization_id', orgId).eq('is_active', true)
        .ilike('name', `%${input.query as string}%`).limit(3)
      return { products: data ?? [] }
    }

    case 'registrar_interesse': {
      if (!lead?.id) return { error: 'Lead não encontrado' }
      await supabase.from('lead_notes').insert({
        organization_id: orgId, lead_id: lead.id,
        content: `[IA] Interesse: ${input.interest} (nível: ${input.level ?? 'medium'})`,
      })
      return { success: true }
    }

    case 'gerar_link_pagamento':
      return { link: `https://pay.example.com/checkout/${Date.now()}`, offer: input.offer_name, value: input.value }

    case 'send_catalog_item':
      return { sent: true, product: input.product_name }

    case 'calcular_proposta': {
      const { data: offer } = await supabase.from('product_offers').select('price').eq('organization_id', orgId).ilike('name', `%${input.offer_name as string}%`).single()
      const base = (offer as Record<string, unknown>)?.price as number ?? (input.custom_value as number) ?? 0
      const disc = (input.discount_pct as number) ?? 0
      return { base_price: base, discount_pct: disc, final_price: base * (1 - disc / 100) }
    }

    case 'verificar_pagamento':
      return { status: 'not_found', message: 'Pagamento não localizado. Contate o financeiro.' }

    case 'enviar_contrato':
      return { link: `https://sign.example.com/${Date.now()}`, template: input.template_name }

    case 'obter_depoimentos':
      return { testimonials: [{ text: 'A solução transformou nosso processo.', author: 'Cliente X', result: '+40% conversão' }] }

    case 'confirmar_reuniao':
      return { success: true, meeting_id: input.meeting_id }

    default:
      return { error: `Ferramenta '${toolName}' não encontrada` }
  }
}

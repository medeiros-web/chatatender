export interface AgentConfig {
  name?: string
  tone?: string
  language?: string
  persona_description?: string
  system_prompt_extra?: string
  business_context?: string
  objection_handling?: string
  spin_enabled?: boolean
  proactive_scheduling?: boolean
}

export function buildSystemPrompt(ctx: {
  agent: AgentConfig | null
  lead: Record<string, unknown> | null
  conv: Record<string, unknown>
}): string {
  const { agent, lead, conv } = ctx
  const lang = agent?.language ?? 'pt-BR'
  const name = agent?.name ?? 'Assistente'

  const toneMap: Record<string, string> = {
    professional: 'profissional e objetivo',
    friendly: 'amigável e empático',
    casual: 'descontraído e informal',
    formal: 'formal e cerimonioso',
  }
  const toneDesc = toneMap[agent?.tone ?? 'professional'] ?? 'profissional'

  const leadCtx = lead
    ? `\n## Lead atual\nNome: ${lead.name ?? 'desconhecido'} | Score: ${lead.lead_score ?? 0}/100`
    : ''

  const spinSection = agent?.spin_enabled !== false ? `
## Metodologia SPIN Selling
Siga a sequência:
- Situation: entenda o contexto atual do lead
- Problem: identifique a dor principal
- Implication: amplie o impacto do problema
- Need-payoff: mostre o valor da solução

Uma pergunta por mensagem. Nunca duas ao mesmo tempo.
` : ''

  const schedulingSection = agent?.proactive_scheduling !== false ? `
## Agendamento proativo
Quando identificar abertura para reunião/demo:
1. Use check_available_slots primeiro
2. Ofereça EXATAMENTE 2 horários específicos
3. Aguarde confirmação ANTES de usar schedule_meeting
4. Só diga "agendado" após schedule_meeting executar com sucesso
` : ''

  const extraSections = [
    agent?.business_context ? `\n## Negócio\n${agent.business_context}` : '',
    agent?.objection_handling ? `\n## Objeções\n${agent.objection_handling}` : '',
    agent?.system_prompt_extra ? `\n## Extra\n${agent.system_prompt_extra}` : '',
  ].join('')

  return `Você é ${name}, assistente de vendas ${toneDesc}.${leadCtx}
${spinSection}${schedulingSection}${extraSections}
## Regras absolutas
- Responda SEMPRE em ${lang}
- Máximo 2 linhas por bloco de resposta
- Uma pergunta por mensagem
- Sem markdown (sem **, *, listas com traço)
- Sem clichês: "Claro!", "Com certeza!", "Posso te ajudar?"
- Nunca prometa agendamento sem executar schedule_meeting
- Se pedir humano: use switch_to_agent imediatamente
- Canal: ${conv.channel ?? 'webchat'} | Status: ${conv.status ?? 'open'}
`
}

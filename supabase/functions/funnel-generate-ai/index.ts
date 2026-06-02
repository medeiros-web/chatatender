import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function genId(): string {
  return Math.random().toString(36).slice(2, 9)
}

interface GenerateRequest {
  prompt: string
  product_name?: string
  organization_id: string
  product_id?: string
  funnel_type?: 'quiz' | 'lead_capture' | 'qualification' | 'booking'
}

const SYSTEM_PROMPT = `Você é especialista em funis de captura e conversão para o mercado brasileiro.
Dado um briefing do usuário, gere um funil de captura completo em JSON.

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "name": "Nome do Funil",
  "slug": "nome-do-funil",
  "description": "Descrição interna do funil",
  "blocks": [
    {
      "id": "b1",
      "type": "statement|question|capture|schedule|redirect",
      "title": "Texto principal do bloco",
      "description": "Texto de apoio (opcional)",
      "options": [
        {"label": "Opção A", "value": "opcao-a", "next_block_id": "b3"},
        {"label": "Opção B", "value": "opcao-b", "next_block_id": "b4"}
      ],
      "next_block_id": "b2"
    }
  ],
  "start_block_id": "b1"
}

REGRAS:
- Máximo 8 blocos
- Sempre começar com um bloco "statement" de boas-vindas
- Incluir pelo menos 2 blocos "question" de qualificação (SPIN Selling)
- Incluir 1 bloco "capture" para coletar nome/email/telefone
- Usar português brasileiro natural, sem clichês de marketing
- Perguntas de qualificação: situação atual, principal dor, urgência, orçamento (SPIN)
- O bloco "capture" é sempre o penúltimo
- O último bloco pode ser "statement" (agradecimento) ou "redirect"
- options só em blocos "question"
- next_block_id liga o bloco ao próximo (usar IDs curtos como b1, b2...)
- slug deve ser: apenas letras minúsculas, números e hífens`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: GenerateRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { prompt, product_name, organization_id, product_id, funnel_type = 'qualification' } = body
  if (!prompt || !organization_id) {
    return new Response(JSON.stringify({ error: 'prompt and organization_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Resolve API key
  const { data: cred } = await supabase
    .from('org_ai_credentials')
    .select('api_key')
    .eq('organization_id', organization_id)
    .eq('provider', 'anthropic')
    .eq('is_active', true)
    .single()

  const apiKey = (cred as Record<string, unknown> | null)?.api_key as string
    ?? Deno.env.get('ANTHROPIC_API_KEY')
    ?? ''

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No AI API key configured' }), {
      status: 422, headers: { 'Content-Type': 'application/json' }
    })
  }

  const userMessage = [
    `Tipo de funil: ${funnel_type}`,
    product_name ? `Produto/Serviço: ${product_name}` : '',
    `Briefing: ${prompt}`,
  ].filter(Boolean).join('\n')

  const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!aiResp.ok) {
    const err = await aiResp.text()
    return new Response(JSON.stringify({ error: `AI error: ${err}` }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    })
  }

  const aiData = await aiResp.json()
  const rawText = (aiData.content as { type: string; text: string }[])?.find(c => c.type === 'text')?.text ?? ''

  let funnelDraft: Record<string, unknown>
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    funnelDraft = JSON.parse(jsonMatch?.[0] ?? rawText)
  } catch {
    return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: rawText }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Normaliza IDs e slug
  const blocks = (funnelDraft.blocks as Record<string, unknown>[]) ?? []
  const idMap: Record<string, string> = {}
  blocks.forEach((b, i) => {
    const oldId = (b.id as string) ?? `b${i + 1}`
    const newId = genId()
    idMap[oldId] = newId
    b.id = newId
  })
  blocks.forEach(b => {
    if (b.next_block_id) b.next_block_id = idMap[b.next_block_id as string] ?? b.next_block_id
    if (Array.isArray(b.options)) {
      (b.options as Record<string, unknown>[]).forEach(opt => {
        if (opt.next_block_id) opt.next_block_id = idMap[opt.next_block_id as string] ?? opt.next_block_id
      })
    }
  })

  const slug = slugify((funnelDraft.slug as string) || (funnelDraft.name as string) || 'funil-gerado')
  const startBlockId = idMap[(funnelDraft.start_block_id as string)] ?? blocks[0]?.id

  // Salva no banco
  const { data: saved, error: saveError } = await supabase.from('capture_funnels').insert({
    organization_id,
    product_id: product_id ?? null,
    name:           funnelDraft.name as string,
    slug,
    description:    (funnelDraft.description as string) ?? `Funil gerado por IA — ${prompt.slice(0, 80)}`,
    status:         'draft',
    blocks,
    start_block_id: startBlockId,
  }).select().single()

  if (saveError) {
    // Slug conflict — add timestamp
    const slugUnique = `${slug}-${Date.now().toString(36)}`
    const { data: saved2, error: err2 } = await supabase.from('capture_funnels').insert({
      organization_id,
      product_id: product_id ?? null,
      name:           funnelDraft.name as string,
      slug:           slugUnique,
      description:    (funnelDraft.description as string) ?? '',
      status:         'draft',
      blocks,
      start_block_id: startBlockId,
    }).select().single()
    if (err2) throw err2
    return new Response(JSON.stringify({ ok: true, funnel: saved2 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ ok: true, funnel: saved }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

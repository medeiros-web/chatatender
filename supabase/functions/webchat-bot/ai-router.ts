import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export interface AIConfig {
  provider: string
  model: string
  apiKey: string
  apiBaseUrl: string
  temperature: number
  maxTokens: number
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    anthropic: 'https://api.anthropic.com',
    openai:    'https://api.openai.com',
    google:    'https://generativelanguage.googleapis.com',
    groq:      'https://api.groq.com/openai',
  }
  return urls[provider] ?? 'https://api.anthropic.com'
}

export async function resolveAIProvider(
  supabase: SupabaseClient,
  orgId: string,
  capability: string,
  agent: Record<string, unknown> | null
): Promise<AIConfig> {
  // 1. Override do agente
  if (agent?.provider && agent?.model) {
    const { data: cred } = await supabase
      .from('org_ai_credentials')
      .select('api_key, api_base_url')
      .eq('organization_id', orgId)
      .eq('provider', agent.provider)
      .eq('is_active', true)
      .single()

    if (cred) {
      return {
        provider: agent.provider as string,
        model: agent.model as string,
        apiKey: cred.api_key as string,
        apiBaseUrl: (cred.api_base_url as string) || getDefaultBaseUrl(agent.provider as string),
        temperature: (agent.temperature as number) ?? 0.7,
        maxTokens: (agent.max_tokens as number) ?? 400,
      }
    }
  }

  // 2. Roteamento da org por capability
  const { data: routing } = await supabase
    .from('org_ai_routing')
    .select('*')
    .eq('organization_id', orgId)
    .eq('capability', capability)
    .eq('is_active', true)
    .single()

  if (routing) {
    const { data: cred } = await supabase
      .from('org_ai_credentials')
      .select('api_key, api_base_url')
      .eq('organization_id', orgId)
      .eq('provider', routing.provider)
      .eq('is_active', true)
      .single()

    if (cred) {
      return {
        provider: routing.provider as string,
        model: routing.model as string,
        apiKey: cred.api_key as string,
        apiBaseUrl: (cred.api_base_url as string) || getDefaultBaseUrl(routing.provider as string),
        temperature: routing.temperature as number,
        maxTokens: routing.max_tokens as number,
      }
    }
  }

  // 3. Default: Anthropic via env
  return {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    apiBaseUrl: 'https://api.anthropic.com',
    temperature: 0.7,
    maxTokens: 400,
  }
}

export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  messages: Record<string, unknown>[],
  tools: Record<string, unknown>[]
): Promise<Record<string, unknown>> {
  return config.provider === 'anthropic'
    ? callAnthropic(config, systemPrompt, messages, tools)
    : callOpenAICompat(config, systemPrompt, messages, tools)
}

async function callAnthropic(
  config: AIConfig,
  systemPrompt: string,
  messages: Record<string, unknown>[],
  tools: Record<string, unknown>[]
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemPrompt,
    messages,
  }
  if (tools.length > 0) body.tools = tools

  const resp = await fetch(`${config.apiBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`)
  return await resp.json()
}

async function callOpenAICompat(
  config: AIConfig,
  systemPrompt: string,
  messages: Record<string, unknown>[],
  tools: Record<string, unknown>[]
): Promise<Record<string, unknown>> {
  const openaiMsgs = [{ role: 'system', content: systemPrompt }, ...messages]
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: openaiMsgs,
  }
  if (tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))
    body.tool_choice = 'auto'
  }

  const resp = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`)

  const data = await resp.json()
  const choice = data.choices?.[0]
  const content: Record<string, unknown>[] = []

  if (choice?.message?.content) content.push({ type: 'text', text: choice.message.content })
  for (const tc of choice?.message?.tool_calls ?? []) {
    content.push({
      type: 'tool_use', id: tc.id, name: tc.function.name,
      input: JSON.parse(tc.function.arguments ?? '{}'),
    })
  }

  return {
    content,
    stop_reason: choice?.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

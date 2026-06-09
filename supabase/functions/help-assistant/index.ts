import { createClient } from 'jsr:@supabase/supabase-js@2'

const SYSTEM_PROMPT = `Você é o assistente de ajuda do ChatAtender, um CRM omnichannel SaaS com agentes de IA autônomos.
Seu papel é explicar funcionalidades, guiar o usuário e responder dúvidas sobre o sistema de forma clara e objetiva.
Responda SEMPRE em português brasileiro. Seja direto, amigável e use exemplos quando útil.

## MÓDULOS DO SISTEMA

### 1. Dashboard (/admin)
- Visão geral de KPIs: total de leads, conversas ativas, taxa de conversão, receita do período
- Gráficos de desempenho por período (diário, semanal, mensal)
- Top agentes e setores por conversão
- Feed de atividades recentes

### 2. Setores e Permissões (/admin/sectors)
- Criação e gestão de setores (ex: Vendas, Suporte, Financeiro)
- Atribuição de membros a setores com roles: manager, agent, viewer
- Configuração de horários de atendimento por setor
- Rotas automáticas de conversas por setor

### 3. Produtos e Pipeline (/admin/products)
- Cadastro de produtos/serviços com preço, descrição e categoria
- Associação de produtos a funis de vendas
- Agentes de IA configurados por produto
- Comissões e metas por produto

### 4. Leads e CRM (/admin/leads)
- Pipeline visual Kanban com drag & drop entre etapas
- Tabela ordenável com filtros avançados
- Histórico completo de cada lead: conversas, notas, atividades
- Tags, scores e segmentação de leads
- Importação em massa via CSV

### 5. CRM Avançado (/admin/crm)
- Funis personalizados com etapas customizadas
- Automações de follow-up e lembretes
- Relatórios de conversão por etapa do funil

### 6. Atendimento Omnichannel (/admin/inbox)
- Caixa de entrada unificada: WhatsApp + webchat + outros canais
- Atribuição manual ou automática de conversas para agentes
- Transferência entre agentes e setores
- Respostas rápidas e templates de mensagem
- Status da conversa: pendente, em atendimento, resolvida
- Histórico completo de mensagens com timeline

### 7. WhatsApp Evolution (/admin/whatsapp)
- Gerenciamento de instâncias: Evolution API e Evolution GO
- Conexão por QR Code com acompanhamento de status em tempo real
- Painel de integração com diagnóstico passo a passo:
  • Testar conectividade do servidor
  • Verificar API key
  • Verificar nome da instância
  • Configurar webhook automaticamente
  • Verificar status de conexão
  • Verificar auto-reply do agente de IA
- Configuração de webhook para receber mensagens
- Suporte a múltiplas instâncias simultâneas

### 8. Agente de IA (/admin/agents)
- Configuração de personas e prompts personalizados por produto
- Integração com múltiplos provedores: Anthropic (Claude), xAI (Grok), DeepSeek, OpenAI, Groq, Google
- Ferramentas disponíveis para o agente:
  • switch_to_agent: transferir para atendente humano
  • criar_nota: registrar anotações no lead
  • registrar_interesse: marcar interesse em produto
  • check_available_slots: verificar horários disponíveis
  • schedule_meeting: agendar reunião/consulta
  • agendar_followup: programar follow-up automático
- Limites de segurança: máx mensagens/dia por org, custo máximo
- Histórico de execuções de ferramentas e logs de auditoria

### 9. Base de Conhecimento / Brain (/admin/brain)
- Adicionar URLs para o agente consultar (websites, artigos)
- Materiais de treinamento: texto livre, FAQ, scripts de vendas, objeções
- Processamento automático de conteúdo via IA
- Entradas de conhecimento indexadas para RAG (busca semântica)
- Auditoria de respostas do agente para qualidade

### 10. Funis de Captação (/admin/funnels)
- Criação de páginas de captura com builder visual
- Integração com formulários de leads
- Publicação em subdomínio da organização (/wl/:slug)
- Rastreamento de conversões

### 11. Formulários (/admin/forms)
- Builder de formulários drag & drop
- Campos: texto, email, telefone, seleção, etc.
- Integração automática com leads ao submeter
- Publicação em URL pública (/f/:slug)

### 12. Calendário (/admin/calendar)
- Agendamentos manuais e automáticos (via agente IA)
- Integração com Google Calendar (OAuth2, sincronização bidirecional)
- Para conectar Google Calendar: clicar em "Conectar Google Calendar" e autorizar acesso
- Criação de horários disponíveis para reservas
- Booking público em URL personalizada (/booking/:slug)

### 13. Pagamentos e Comissões (/admin/payments, /admin/commissions)
- Registros de pagamentos associados a leads e produtos
- Cálculo automático de comissões por agente/vendedor
- Integração com plataformas: Hotmart, Cakto, Doppus (via webhooks)
- Relatórios financeiros por período e produto

### 14. Notificações (/admin/notifications)
- Central de notificações do sistema
- Configuração de alertas: novas mensagens, leads atribuídos, metas atingidas
- Templates de notificação por email

### 15. Templates de Email (/admin/email-templates)
- Editor de templates HTML para emails
- Variáveis dinâmicas com dados do lead
- Envio de emails automáticos via regras de automação

### 16. Configurações (/admin/settings)
- Perfil da organização
- Usuários e permissões
- Integrações com plataformas externas
- Chaves de API de provedores de IA
- Configurações de WhatsApp e canais

## ROLES E PERMISSÕES
- **super_admin**: acesso total ao painel super-admin (gestão de todas as organizações)
- **admin**: controle total da organização
- **manager**: gestão de setores e agentes sob sua responsabilidade
- **agent**: atendimento de conversas e leads atribuídos
- **viewer**: somente visualização

## DICAS RÁPIDAS
- Para iniciar integração WhatsApp: vá em WhatsApp → clique na instância → "Conectar" → escaneie o QR Code
- Para criar um agente de IA: vá em Agentes → Novo Agente → configure persona, tools e credenciais de IA
- Para rastrear uma venda do Hotmart: configure o webhook em Configurações → a venda aparece automaticamente em Pagamentos
- Para o agente responder automaticamente no WhatsApp: ative "auto_reply" na instância e configure um agente para o produto

Quando não souber algo específico sobre o sistema do usuário, seja honesto e sugira verificar nas configurações ou entrar em contato com o suporte.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify JWT
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  if (!body.messages?.length) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 })
  }

  // Get org AI credentials (prefer org config, fallback to Anthropic env)
  const { data: orgProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  let apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  let provider = 'anthropic'
  let model = 'claude-haiku-4-5'
  let baseUrl = 'https://api.anthropic.com'

  if (orgProfile?.organization_id) {
    const { data: cred } = await supabase
      .from('org_ai_credentials')
      .select('*')
      .eq('organization_id', orgProfile.organization_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cred) {
      apiKey = cred.api_key
      provider = cred.provider
      baseUrl = cred.api_base_url || getDefaultBaseUrl(cred.provider)
      model = provider === 'anthropic' ? 'claude-haiku-4-5' :
              provider === 'xai' ? 'grok-3-mini' :
              provider === 'deepseek' ? 'deepseek-chat' :
              provider === 'groq' ? 'llama-3.3-70b-versatile' :
              'gpt-4o-mini'
    }
  }

  try {
    let responseText = ''

    if (provider === 'anthropic') {
      const resp = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          temperature: 0.5,
          system: SYSTEM_PROMPT,
          messages: body.messages,
        }),
      })
      if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`)
      const data = await resp.json()
      responseText = data.content?.find((c: Record<string, unknown>) => c.type === 'text')?.text ?? ''
    } else {
      // OpenAI-compatible
      const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          temperature: 0.5,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...body.messages,
          ],
        }),
      })
      if (!resp.ok) throw new Error(`AI ${resp.status}: ${await resp.text()}`)
      const data = await resp.json()
      responseText = data.choices?.[0]?.message?.content ?? ''
    }

    return new Response(JSON.stringify({ response: responseText }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    anthropic: 'https://api.anthropic.com',
    openai:    'https://api.openai.com',
    google:    'https://generativelanguage.googleapis.com/v1beta/openai',
    groq:      'https://api.groq.com/openai',
    xai:       'https://api.x.ai',
    deepseek:  'https://api.deepseek.com',
  }
  return urls[provider] ?? 'https://api.anthropic.com'
}

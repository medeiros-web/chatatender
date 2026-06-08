import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot, Plus, Pencil, Eye, EyeOff, Check, AlertCircle,
  Zap, Shield, Settings, Brain, Key, BarChart3,
  ToggleRight, ToggleLeft, Flame, DollarSign, Activity,
  MessageSquare, ChevronDown, ChevronUp, Lightbulb, Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useProducts } from '@/hooks/useProducts'
import {
  useAllAgents, useProductAgent, useUpsertAgent,
  useAICredentials, useUpsertCredential,
  useAIRouting, useUpdateRouting,
  useSafetyLimits, useUpdateSafetyLimits, useAgentLogs,
  TOOLS_SCHEMA_LABELS, type AIProvider, type AICapability,
} from '@/hooks/useAgents'

// ── Constants ────────────────────────────────────────────────
const AI_PROVIDERS: { value: AIProvider; label: string; models: string[]; badge?: string; color?: string }[] = [
  { value: 'anthropic', label: 'Claude (Anthropic)', models: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5'], color: '#D97757' },
  { value: 'openai',    label: 'GPT (OpenAI)',        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-mini', 'o3-mini'], color: '#10A37F' },
  { value: 'google',    label: 'Gemini (Google)',     models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-pro'], color: '#4285F4' },
  { value: 'xai',       label: 'Grok (xAI)',          models: ['grok-3-mini-beta', 'grok-3-beta', 'grok-2-latest'], badge: 'Novo', color: '#1DA1F2' },
  { value: 'deepseek',  label: 'DeepSeek',            models: ['deepseek-chat', 'deepseek-reasoner'], badge: 'Econômico', color: '#2563EB' },
  { value: 'groq',      label: 'Groq (velocidade)',   models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it'], color: '#FF7A00' },
  { value: 'custom',    label: 'Custom / Proxy',       models: [] },
]

const CAPABILITY_LABELS: Record<AICapability, string> = {
  agent_chat:           'Chat do agente (vendas)',
  sales_copilot:        'Copiloto de vendas',
  audio_transcription:  'Transcrição de áudio',
  image_vision:         'Visão de imagem',
  embedding:            'Embeddings',
  summarization:        'Sumarização',
}

const ALL_TOOLS = [
  { name: 'criar_deal',               label: 'Criar negócio (deal)',          group: 'CRM' },
  { name: 'gerar_link_pagamento',      label: 'Gerar link de pagamento',        group: 'Vendas' },
  { name: 'aplicar_etiqueta',          label: 'Aplicar etiqueta ao lead',       group: 'CRM' },
  { name: 'agendar_followup',          label: 'Agendar follow-up',             group: 'CRM' },
  { name: 'consultar_historico_cliente', label: 'Consultar histórico do lead', group: 'CRM' },
  { name: 'schedule_meeting',          label: 'Agendar reunião',               group: 'Agendamento' },
  { name: 'check_available_slots',     label: 'Ver horários disponíveis',      group: 'Agendamento' },
  { name: 'switch_to_agent',           label: 'Transferir para humano',        group: 'Handoff' },
  { name: 'send_catalog_item',         label: 'Enviar item do catálogo',       group: 'Vendas' },
  { name: 'atualizar_lead',            label: 'Atualizar dados do lead',       group: 'CRM' },
  { name: 'criar_nota',                label: 'Criar nota interna',            group: 'CRM' },
  { name: 'buscar_produto',            label: 'Buscar produto no catálogo',    group: 'Vendas' },
  { name: 'calcular_proposta',         label: 'Calcular proposta',             group: 'Vendas' },
  { name: 'verificar_pagamento',       label: 'Verificar pagamento',           group: 'Financeiro' },
  { name: 'enviar_contrato',           label: 'Enviar contrato',               group: 'Vendas' },
  { name: 'registrar_interesse',       label: 'Registrar interesse',           group: 'CRM' },
  { name: 'obter_depoimentos',         label: 'Obter depoimentos/cases',       group: 'Social proof' },
  { name: 'confirmar_reuniao',         label: 'Confirmar reunião agendada',    group: 'Agendamento' },
]

const TOOL_GROUPS = [...new Set(ALL_TOOLS.map(t => t.group))]

// ── Agent Form ────────────────────────────────────────────────
const PROMPT_TEMPLATES = [
  {
    label: 'Vendas B2C',
    icon: '🛒',
    prompt: `Você é um assistente de vendas especialista, educado e empático. Seu objetivo é entender as necessidades do cliente e apresentar as melhores soluções de forma clara e objetiva.

- Sempre cumprimente pelo nome quando disponível
- Faça perguntas para entender a necessidade antes de oferecer produtos
- Seja conciso: máximo 3 parágrafos por mensagem
- Nunca pressione o cliente; respeite o ritmo dele
- Em caso de dúvida técnica, ofereça transferir para um especialista`,
  },
  {
    label: 'Suporte técnico',
    icon: '🔧',
    prompt: `Você é um agente de suporte técnico especializado. Ajude o cliente a resolver problemas de forma rápida e eficiente.

- Identifique o problema com perguntas diretas (modelo, versão, erro exato)
- Forneça passos numerados e claros
- Confirme se o problema foi resolvido antes de encerrar
- Registre sempre o ticket no sistema antes de finalizar`,
  },
  {
    label: 'Atendimento geral',
    icon: '💬',
    prompt: `Você é um atendente virtual cordial e prestativo. Responda com clareza, gentileza e objetividade.

- Trate todos com respeito e atenção
- Resolva dúvidas frequentes de forma autônoma
- Encaminhe ao time humano quando necessário
- Mantenha um tom sempre positivo e acolhedor`,
  },
]

const agentSchema = z.object({
  name: z.string().min(1, 'Obrigatório'),
  tone: z.string(),
  language: z.string(),
  provider: z.string(),
  model: z.string().min(1, 'Obrigatório'),
  temperature: z.number().min(0).max(1),
  max_tokens: z.number().min(50).max(2000),
  spin_enabled: z.boolean(),
  proactive_scheduling: z.boolean(),
  persona_description: z.string().optional(),
  business_context: z.string().optional(),
  objection_handling: z.string().optional(),
  system_prompt_extra: z.string().optional(),
  max_messages_before_handoff: z.number().min(1).max(100),
})
type AgentValues = z.infer<typeof agentSchema>

function AgentFormDialog({
  open, onClose, productId, existingAgent,
}: {
  open: boolean
  onClose: () => void
  productId: string
  existingAgent?: ReturnType<typeof useProductAgent>['data']
}) {
  const upsert = useUpsertAgent()
  const [enabledTools, setEnabledTools] = useState<string[]>(
    existingAgent?.enabled_tools ?? ['switch_to_agent', 'criar_nota', 'registrar_interesse', 'check_available_slots', 'schedule_meeting', 'agendar_followup']
  )
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(existingAgent?.provider ?? 'anthropic')
  const [showTemplates, setShowTemplates] = useState(false)
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<AgentValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: existingAgent?.name ?? 'Assistente de Vendas',
      tone: existingAgent?.tone ?? 'professional',
      language: existingAgent?.language ?? 'pt-BR',
      provider: existingAgent?.provider ?? 'anthropic',
      model: existingAgent?.model ?? 'claude-haiku-4-5',
      temperature: existingAgent?.temperature ?? 0.7,
      max_tokens: existingAgent?.max_tokens ?? 400,
      spin_enabled: existingAgent?.spin_enabled ?? true,
      proactive_scheduling: existingAgent?.proactive_scheduling ?? true,
      persona_description: existingAgent?.persona_description ?? '',
      business_context: existingAgent?.business_context ?? '',
      objection_handling: existingAgent?.objection_handling ?? '',
      system_prompt_extra: existingAgent?.system_prompt_extra ?? '',
      max_messages_before_handoff: existingAgent?.max_messages_before_handoff ?? 20,
    },
  })

  const spinEnabled = watch('spin_enabled')
  const proScheduling = watch('proactive_scheduling')
  const temp = watch('temperature')
  const personaDesc = watch('persona_description') ?? ''
  const businessCtx = watch('business_context') ?? ''
  const objHandling = watch('objection_handling') ?? ''
  const sysPrompt = watch('system_prompt_extra') ?? ''

  const providerModels = AI_PROVIDERS.find(p => p.value === selectedProvider)?.models ?? []

  const toggleTool = (name: string) => {
    setEnabledTools(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    )
  }

  const applyTemplate = (templatePrompt: string, label: string) => {
    setValue('persona_description', templatePrompt)
    setCopiedTemplate(label)
    setShowTemplates(false)
    setTimeout(() => setCopiedTemplate(null), 2000)
  }

  const onSubmit = async (values: AgentValues) => {
    await upsert.mutateAsync({
      ...values,
      product_id: productId,
      enabled_tools: enabledTools,
      provider: values.provider as AIProvider,
      tone: values.tone as 'professional' | 'friendly' | 'casual' | 'formal',
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            {existingAgent ? 'Editar agente' : 'Configurar agente IA'}
          </DialogTitle>
          <DialogDescription>Configure personalidade, modelo e ferramentas do agente para este produto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <Tabs defaultValue="prompts">
              <TabsList className="mb-4">
                <TabsTrigger value="prompts" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" /> Prompts
                </TabsTrigger>
                <TabsTrigger value="persona" className="text-xs">Persona</TabsTrigger>
                <TabsTrigger value="model" className="text-xs">Modelo IA</TabsTrigger>
                <TabsTrigger value="tools" className="text-xs">Ferramentas</TabsTrigger>
              </TabsList>

              {/* Prompts */}
              <TabsContent value="prompts" className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">

                {/* Templates rápidos */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowTemplates(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Lightbulb className="h-3.5 w-3.5 text-warning" />
                      Templates rápidos
                      {copiedTemplate && (
                        <span className="text-[10px] rounded px-1.5 py-0.5 bg-success/15 text-success font-semibold">
                          ✓ {copiedTemplate} aplicado
                        </span>
                      )}
                    </span>
                    {showTemplates
                      ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </button>
                  {showTemplates && (
                    <div className="border-t border-border p-3 grid grid-cols-3 gap-2">
                      {PROMPT_TEMPLATES.map(t => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => applyTemplate(t.prompt, t.label)}
                          className="flex flex-col gap-1 rounded-lg border border-border p-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all"
                        >
                          <span className="text-base leading-none">{t.icon}</span>
                          <span className="text-xs font-medium text-foreground">{t.label}</span>
                          <span className="text-[10px] text-muted-foreground line-clamp-2">
                            {t.prompt.split('\n')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt Principal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      Prompt principal (Persona)
                    </Label>
                    <span className={cn(
                      'text-[10px] font-mono',
                      personaDesc.length > 1800 ? 'text-destructive' : personaDesc.length > 1200 ? 'text-warning' : 'text-muted-foreground'
                    )}>
                      {personaDesc.length} / 2000
                    </span>
                  </div>
                  <textarea
                    className="w-full min-h-[160px] rounded-xl border border-input bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono leading-relaxed"
                    placeholder={`Defina aqui a personalidade e comportamento principal do agente.

Exemplo:
Você é um assistente de vendas especialista e empático. Seu objetivo é entender as necessidades do cliente e apresentar as melhores soluções de forma clara.

- Sempre cumprimente pelo nome
- Faça perguntas antes de oferecer produtos
- Seja conciso (máx 3 parágrafos por mensagem)
- Nunca pressione o cliente`}
                    maxLength={2000}
                    {...register('persona_description')}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Este prompt define a identidade base do agente. Será combinado com o contexto do negócio e as instruções de venda.
                  </p>
                </div>

                <Separator />

                {/* Contexto do negócio */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Contexto do negócio / produto</Label>
                    <span className="text-[10px] font-mono text-muted-foreground">{businessCtx.length} / 800</span>
                  </div>
                  <textarea
                    className="w-full min-h-[80px] rounded-xl border border-input bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="Descreva o produto/serviço, diferenciais, preços, público-alvo, políticas de uso..."
                    maxLength={800}
                    {...register('business_context')}
                  />
                </div>

                {/* Tratamento de objeções */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Tratamento de objeções</Label>
                    <span className="text-[10px] font-mono text-muted-foreground">{objHandling.length} / 600</span>
                  </div>
                  <textarea
                    className="w-full min-h-[70px] rounded-xl border border-input bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder={`Como responder às objeções mais comuns:\n"Está caro" → ...\n"Preciso pensar" → ...\n"Vou ver com minha empresa" → ...`}
                    maxLength={600}
                    {...register('objection_handling')}
                  />
                </div>

                {/* Instruções extras */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Instruções adicionais</Label>
                    <span className="text-[10px] font-mono text-muted-foreground">{sysPrompt.length} / 400</span>
                  </div>
                  <textarea
                    className="w-full min-h-[60px] rounded-xl border border-input bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="Regras específicas, restrições, palavras proibidas, formato de resposta esperado..."
                    maxLength={400}
                    {...register('system_prompt_extra')}
                  />
                </div>
              </TabsContent>

              {/* Persona */}
              <TabsContent value="persona" className="space-y-4 max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome do agente</Label>
                    <Input placeholder="Assistente de Vendas" {...register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Idioma</Label>
                    <Select defaultValue="pt-BR" onValueChange={v => setValue('language', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (BR)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Tom de voz</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 'professional', label: 'Profissional', desc: 'Objetivo e direto' },
                      { value: 'friendly',     label: 'Amigável',     desc: 'Empático e próximo' },
                      { value: 'casual',       label: 'Casual',       desc: 'Descontraído' },
                      { value: 'formal',       label: 'Formal',       desc: 'Cerimonioso' },
                    ].map(tone => {
                      const current = watch('tone')
                      return (
                        <button key={tone.value} type="button"
                          onClick={() => setValue('tone', tone.value)}
                          className={cn(
                            'flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition-all',
                            current === tone.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                          )}>
                          <span className={cn('text-xs font-semibold', current === tone.value ? 'text-primary' : 'text-foreground')}>{tone.label}</span>
                          <span className="text-[10px] text-muted-foreground">{tone.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-primary" /> SPIN Selling
                      </p>
                      <p className="text-xs text-muted-foreground">Methodologia Situation, Problem, Implication, Need-payoff</p>
                    </div>
                    <Switch checked={spinEnabled} onCheckedChange={v => setValue('spin_enabled', v)} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-accent" /> Agendamento proativo
                      </p>
                      <p className="text-xs text-muted-foreground">Sempre oferecer 2 horários específicos quando detectar interesse</p>
                    </div>
                    <Switch checked={proScheduling} onCheckedChange={v => setValue('proactive_scheduling', v)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Msgs antes do handoff</Label>
                    <Input type="number" min={1} max={100} {...register('max_messages_before_handoff', { valueAsNumber: true })} />
                  </div>
                </div>
              </TabsContent>

              {/* Modelo IA */}
              <TabsContent value="model" className="space-y-4 max-h-[50vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AI_PROVIDERS.map(p => (
                      <button key={p.value} type="button"
                        onClick={() => { setSelectedProvider(p.value); setValue('provider', p.value); setValue('model', p.models[0] ?? '') }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border-2 p-2.5 text-left transition-all',
                          selectedProvider === p.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                        )}>
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProvider === p.value ? (p.color ?? 'var(--primary)') : 'var(--muted-foreground)' }} />
                        <span className={cn('text-xs font-medium flex-1', selectedProvider === p.value ? 'text-primary' : 'text-foreground')}>{p.label}</span>
                        {p.badge && <span className="text-[9px] rounded px-1 py-0.5 bg-primary/10 text-primary font-semibold">{p.badge}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedProvider !== 'custom' ? (
                  <div className="space-y-1.5">
                    <Label>Modelo</Label>
                    <Select defaultValue={watch('model')} onValueChange={v => setValue('model', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {providerModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Nome do modelo (custom)</Label>
                    <Input placeholder="nome-do-modelo" {...register('model')} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Temperatura: <span className="text-primary font-mono">{temp}</span></Label>
                    <Input type="range" min={0} max={1} step={0.1} {...register('temperature', { valueAsNumber: true })}
                      className="h-2 cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Preciso</span><span>Criativo</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max tokens por resposta</Label>
                    <Input type="number" min={50} max={2000} {...register('max_tokens', { valueAsNumber: true })} />
                  </div>
                </div>
              </TabsContent>

              {/* Ferramentas */}
              <TabsContent value="tools" className="max-h-[50vh] overflow-y-auto space-y-3">
                <p className="text-xs text-muted-foreground">
                  {enabledTools.length} de {ALL_TOOLS.length} ferramentas habilitadas
                </p>
                {TOOL_GROUPS.map(group => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{group}</p>
                    <div className="space-y-1">
                      {ALL_TOOLS.filter(t => t.group === group).map(tool => {
                        const enabled = enabledTools.includes(tool.name)
                        return (
                          <div key={tool.name}
                            onClick={() => toggleTool(tool.name)}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors',
                              enabled ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary/50 border border-transparent'
                            )}>
                            <div className={cn('h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                              enabled ? 'bg-primary border-primary' : 'border-border')}>
                              {enabled && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className={cn('text-sm', enabled ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                              {tool.label}
                            </span>
                            {tool.name === 'switch_to_agent' && (
                              <Badge variant="muted" className="ml-auto text-[10px]">Recomendado</Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>

            </Tabs>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>
              {existingAgent ? 'Salvar agente' : 'Criar agente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Credentials Panel ─────────────────────────────────────────
function CredentialsPanel() {
  const { data: creds = [] } = useAICredentials()
  const upsertCred = useUpsertCredential()
  const [adding, setAdding] = useState<AIProvider | null>(null)
  const [keyValues, setKeyValues] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  const handleSave = async (provider: AIProvider) => {
    const key = keyValues[provider]?.trim()
    if (!key) return
    await upsertCred.mutateAsync({ provider, api_key: key })
    setAdding(null)
    setKeyValues(prev => ({ ...prev, [provider]: '' }))
  }

  const configuredProviders = creds.map(c => c.provider)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" /> Credenciais de IA
        </CardTitle>
        <CardDescription>Chaves por provider. As credenciais são usadas no roteamento automático.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {AI_PROVIDERS.filter(p => p.value !== 'custom').map(provider => {
          const cred = creds.find(c => c.provider === provider.value)
          const isAdding = adding === provider.value

          return (
            <div key={provider.value} className={cn('flex items-center gap-3 rounded-xl border p-3 transition-colors', cred?.is_active ? 'border-success/30 bg-success/5' : 'border-border')}>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${provider.color}20` }}>
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cred?.is_active ? '#22c55e' : (provider.color ?? '#94a3b8') }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{provider.label}</p>
                  {provider.badge && <span className="text-[9px] rounded px-1.5 py-0.5 bg-primary/10 text-primary font-semibold">{provider.badge}</span>}
                </div>
                {cred ? (
                  <p className="text-xs text-muted-foreground font-mono">
                    {showKey[provider.value] ? cred.api_key : '••••••••' + cred.api_key.slice(-4)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Não configurado</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {cred && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowKey(prev => ({ ...prev, [provider.value]: !prev[provider.value] }))}>
                    {showKey[provider.value] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setAdding(isAdding ? null : provider.value)}>
                  <Pencil className="h-3 w-3" /> {cred ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </div>
          )
        })}

        {adding && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium text-primary">
              Configurando {AI_PROVIDERS.find(p => p.value === adding)?.label}
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Cole sua API key aqui"
                value={keyValues[adding] ?? ''}
                onChange={e => setKeyValues(prev => ({ ...prev, [adding]: e.target.value }))}
                className="flex-1"
              />
              <Button size="sm" loading={upsertCred.isPending} onClick={() => handleSave(adding)}>
                <Check className="h-3.5 w-3.5" /> Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Safety Panel ─────────────────────────────────────────────
function SafetyPanel() {
  const { data: limits } = useSafetyLimits()
  const updateLimits = useUpdateSafetyLimits()

  if (!limits) return null

  const execPct = Math.min((limits.current_day_executions / limits.max_executions_per_day) * 100, 100)
  const costPct  = Math.min((limits.current_day_cost_usd / limits.max_cost_usd_per_day) * 100, 100)

  return (
    <Card className={cn(limits.is_paused && 'border-destructive/30')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Limites de Segurança
          </CardTitle>
          {limits.is_paused && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" /> Pausado
            </Badge>
          )}
        </div>
        <CardDescription>Contadores diários são resetados automaticamente à meia-noite.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Execuções */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-foreground"><Activity className="h-3.5 w-3.5 text-primary" /> Execuções hoje</span>
            <span className="font-mono text-xs">{limits.current_day_executions.toLocaleString()} / {limits.max_executions_per_day.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', execPct > 90 ? 'bg-destructive' : execPct > 70 ? 'bg-warning' : 'bg-primary')}
              style={{ width: `${execPct}%` }} />
          </div>
        </div>

        {/* Custo */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-foreground"><DollarSign className="h-3.5 w-3.5 text-success" /> Custo hoje</span>
            <span className="font-mono text-xs">${limits.current_day_cost_usd.toFixed(4)} / ${limits.max_cost_usd_per_day}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', costPct > 90 ? 'bg-destructive' : costPct > 70 ? 'bg-warning' : 'bg-success')}
              style={{ width: `${costPct}%` }} />
          </div>
        </div>

        <Separator />

        {/* Config de limites */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Max execuções/dia</Label>
            <Input type="number" defaultValue={limits.max_executions_per_day}
              className="h-8 text-sm"
              onBlur={e => updateLimits.mutate({ max_executions_per_day: parseInt(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max custo/dia (USD)</Label>
            <Input type="number" step="0.01" defaultValue={limits.max_cost_usd_per_day}
              className="h-8 text-sm"
              onBlur={e => updateLimits.mutate({ max_cost_usd_per_day: parseFloat(e.target.value) })} />
          </div>
        </div>

        {limits.is_paused && (
          <Button variant="outline" size="sm" className="w-full"
            onClick={() => updateLimits.mutate({ is_paused: false, pause_reason: null })}>
            Reativar agente
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ── Logs Panel ────────────────────────────────────────────────
function LogsPanel() {
  const { data: logs = [] } = useAgentLogs(30)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Últimas ações (30)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ação registrada.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(logs as Record<string, unknown>[]).map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', log.success ? 'bg-success' : 'bg-destructive')} />
                <span className="text-muted-foreground w-16 flex-shrink-0">{log.action_type as string}</span>
                <span className="text-foreground flex-1 truncate">{(log.ai_model as string | null) ?? '—'}</span>
                {log.cost_usd != null && <span className="text-muted-foreground font-mono">${(log.cost_usd as number).toFixed(5)}</span>}
                <span className="text-muted-foreground flex-shrink-0">
                  {new Date(log.created_at as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  AgentsPage                                              ║
// ╚══════════════════════════════════════════════════════════╝
export function AgentsPage() {
  const { data: products = [] } = useProducts()
  const { data: agents = [], isLoading } = useAllAgents()
  const [formOpen, setFormOpen] = useState<{ productId: string } | null>(null)
  const [activeTab, setActiveTab] = useState('agents')

  const productsWithAgent = products.map(p => ({
    ...p,
    agent: (agents as unknown as Record<string, unknown>[]).find(a => a.product_id === p.id) ?? null,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Agentes IA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure agentes autônomos por produto com SPIN Selling, ferramentas e safety limits.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="agents">
            <Bot className="h-3.5 w-3.5 mr-1.5" /> Agentes
          </TabsTrigger>
          <TabsTrigger value="credentials">
            <Key className="h-3.5 w-3.5 mr-1.5" /> Credenciais
          </TabsTrigger>
          <TabsTrigger value="safety">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="logs">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Agentes por produto */}
        <TabsContent value="agents" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-card animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Bot className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Crie um produto primeiro para configurar agentes.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {productsWithAgent.map(product => {
                const agent = product.agent as Record<string, unknown> | null
                return (
                  <Card key={product.id} className={cn('transition-all', agent ? 'border-primary/20' : '')}>
                    <CardContent className="p-4 space-y-3">
                      {/* Produto */}
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <Bot className={cn('h-4 w-4', agent ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                          {agent ? (
                            <p className="text-xs text-muted-foreground">{agent.name as string} · {agent.model as string}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Sem agente configurado</p>
                          )}
                        </div>
                        {agent && (
                          <div className={cn('h-2 w-2 rounded-full', agent.is_active ? 'bg-success' : 'bg-muted-foreground')} />
                        )}
                      </div>

                      {agent && (
                        <div className="flex flex-wrap gap-1.5">
                          {!!agent.spin_enabled && <Badge variant="default" className="text-[10px]"><Brain className="h-2.5 w-2.5 mr-1" /> SPIN</Badge>}
                          {!!agent.proactive_scheduling && <Badge variant="secondary" className="text-[10px]"><Zap className="h-2.5 w-2.5 mr-1" /> Agendamento</Badge>}
                          <Badge variant="muted" className="text-[10px]">{(agent.enabled_tools as string[])?.length ?? 0} ferramentas</Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{agent.tone as string}</Badge>
                        </div>
                      )}

                      <Button
                        variant={agent ? 'outline' : 'default'}
                        size="sm"
                        className="w-full"
                        onClick={() => setFormOpen({ productId: product.id })}>
                        {agent ? (
                          <><Pencil className="h-3.5 w-3.5" /> Editar agente</>
                        ) : (
                          <><Plus className="h-3.5 w-3.5" /> Configurar agente</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="credentials" className="mt-4">
          <CredentialsPanel />
        </TabsContent>

        <TabsContent value="safety" className="mt-4">
          <SafetyPanel />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <LogsPanel />
        </TabsContent>
      </Tabs>

      {/* Modal de agente */}
      {formOpen && (
        <AgentFormDialog
          open={!!formOpen}
          onClose={() => setFormOpen(null)}
          productId={formOpen.productId}
          existingAgent={(agents as unknown as ReturnType<typeof useProductAgent>['data'][]).find(a => a?.product_id === formOpen.productId)}
        />
      )}
    </div>
  )
}

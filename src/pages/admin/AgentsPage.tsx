import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Bot, Plus, Pencil, Eye, EyeOff, Check, AlertCircle,
  Zap, Shield, Settings, Brain, Key, BarChart3,
  ToggleRight, ToggleLeft, Flame, DollarSign, Activity
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
const AI_PROVIDERS: { value: AIProvider; label: string; models: string[] }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5'] },
  { value: 'openai',    label: 'OpenAI (GPT)',       models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  { value: 'groq',      label: 'Groq (rápido)',      models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it'] },
  { value: 'google',    label: 'Google (Gemini)',    models: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
  { value: 'custom',    label: 'Custom/Proxy',       models: [] },
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
      business_context: existingAgent?.business_context ?? '',
      objection_handling: existingAgent?.objection_handling ?? '',
      system_prompt_extra: existingAgent?.system_prompt_extra ?? '',
      max_messages_before_handoff: existingAgent?.max_messages_before_handoff ?? 20,
    },
  })

  const spinEnabled = watch('spin_enabled')
  const proScheduling = watch('proactive_scheduling')
  const temp = watch('temperature')

  const providerModels = AI_PROVIDERS.find(p => p.value === selectedProvider)?.models ?? []

  const toggleTool = (name: string) => {
    setEnabledTools(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    )
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
            <Tabs defaultValue="persona">
              <TabsList className="mb-4">
                <TabsTrigger value="persona" className="text-xs">Persona</TabsTrigger>
                <TabsTrigger value="model" className="text-xs">Modelo IA</TabsTrigger>
                <TabsTrigger value="tools" className="text-xs">Ferramentas</TabsTrigger>
                <TabsTrigger value="context" className="text-xs">Contexto</TabsTrigger>
              </TabsList>

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
                        <div className={cn('h-2 w-2 rounded-full', selectedProvider === p.value ? 'bg-primary' : 'bg-muted-foreground')} />
                        <span className={cn('text-xs font-medium', selectedProvider === p.value ? 'text-primary' : 'text-foreground')}>{p.label}</span>
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

              {/* Contexto */}
              <TabsContent value="context" className="space-y-4 max-h-[50vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <Label>Contexto do negócio</Label>
                  <textarea
                    className="w-full min-h-[80px] rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="Descreva o produto/serviço, diferenciais, público-alvo..."
                    {...register('business_context')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tratamento de objeções</Label>
                  <textarea
                    className="w-full min-h-[80px] rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="Como responder 'caro demais', 'preciso pensar', 'vou ver com a empresa'..."
                    {...register('objection_handling')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Instruções extras (system prompt)</Label>
                  <textarea
                    className="w-full min-h-[60px] rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder="Instruções específicas adicionais para o agente..."
                    {...register('system_prompt_extra')}
                  />
                </div>
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
            <div key={provider.value} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', cred?.is_active ? 'bg-success' : 'bg-muted-foreground')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{provider.label}</p>
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
                          {agent.spin_enabled && <Badge variant="default" className="text-[10px]"><Brain className="h-2.5 w-2.5 mr-1" /> SPIN</Badge>}
                          {agent.proactive_scheduling && <Badge variant="secondary" className="text-[10px]"><Zap className="h-2.5 w-2.5 mr-1" /> Agendamento</Badge>}
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
          existingAgent={(agents as Record<string, unknown>[]).find(a => a.product_id === formOpen.productId) as ReturnType<typeof useProductAgent>['data']}
        />
      )}
    </div>
  )
}

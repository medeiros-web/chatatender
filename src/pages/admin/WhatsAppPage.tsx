import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Phone, Plus, Wifi, WifiOff, QrCode, RefreshCw, Trash2,
  Pencil, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  MessageSquare, Zap, Settings, ExternalLink, Copy, Check,
  Globe, Key, ChevronDown, Bot, Sparkles, ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useEvolutionInstances, useCreateInstance, useUpdateInstance,
  useDeleteInstance, useConnectInstance, useDisconnectInstance,
  useRefreshStatus, useSetWebhook, usePollQRCode,
  type EvolutionInstance, type EvolutionProvider,
} from '@/hooks/useEvolution'
import { useAICredentials } from '@/hooks/useAgents'

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Claude',
  openai:    'GPT',
  google:    'Gemini',
  groq:      'Groq',
  xai:       'Grok',
  deepseek:  'DeepSeek',
}

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; pulse?: boolean }> = {
  connected:    { label: 'Conectado',    color: 'text-success',         icon: CheckCircle2 },
  connecting:   { label: 'Conectando…', color: 'text-warning-foreground', icon: Loader2, pulse: true },
  qr_code:      { label: 'Aguard. QR',  color: 'text-primary',          icon: QrCode, pulse: true },
  disconnected: { label: 'Desconectado', color: 'text-muted-foreground', icon: WifiOff },
  error:        { label: 'Erro',         color: 'text-destructive',      icon: AlertCircle },
}

// ── QR Code Modal ─────────────────────────────────────────────
function QRCodeModal({
  instance, open, onClose,
}: { instance: EvolutionInstance; open: boolean; onClose: () => void }) {
  const { data: polled } = usePollQRCode(open ? instance.id : null)
  const connectInstance = useConnectInstance()

  const current = polled ?? instance
  const isConnected = current.status === 'connected'
  const hasQR = !!current.qr_code_base64

  // Countdown timer — resets when QR image changes
  const [timeLeft, setTimeLeft] = useState(60)
  const prevQrRef = useRef<string | null>(null)

  useEffect(() => {
    if (current.qr_code_base64 !== prevQrRef.current) {
      prevQrRef.current = current.qr_code_base64 ?? null
      setTimeLeft(60)
    }
  }, [current.qr_code_base64])

  useEffect(() => {
    if (!hasQR || isConnected || timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [hasQR, isConnected, timeLeft])

  useEffect(() => {
    if (isConnected) setTimeout(onClose, 2500)
  }, [isConnected, onClose])

  const expired = timeLeft <= 0 && hasQR && !isConnected
  const progress = (timeLeft / 60) * 100

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#25D366]/15 flex items-center justify-center">
              <Phone className="h-4 w-4 text-[#25D366]" />
            </div>
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Instância <strong className="text-foreground">{instance.display_name ?? instance.instance_name}</strong>
            {' · '}{instance.provider === 'evolution_go' ? 'Evolution GO' : 'Evolution API'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {isConnected ? (
            /* ── CONECTADO ── */
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <div className="absolute inset-0 rounded-full bg-success/20 animate-ping" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-lg text-foreground">WhatsApp conectado!</p>
                {current.phone_number && (
                  <p className="text-sm text-success font-medium">{current.phone_number}</p>
                )}
                <p className="text-xs text-muted-foreground">Fechando automaticamente...</p>
              </div>
            </div>
          ) : hasQR ? (
            /* ── QR CODE ── */
            <div className="flex flex-col items-center gap-3">
              {/* QR image */}
              <div className={cn(
                'relative rounded-2xl border-4 p-1.5 bg-white shadow-lg transition-all',
                expired ? 'border-destructive/40 opacity-50' : 'border-[#25D366]/40'
              )}>
                <img
                  src={`data:image/png;base64,${current.qr_code_base64}`}
                  alt="QR Code WhatsApp"
                  className="h-52 w-52 rounded-xl"
                />
                {expired && (
                  <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-sm font-semibold text-foreground">QR expirado</p>
                  </div>
                )}
              </div>

              {/* Timer */}
              {!expired ? (
                <div className="w-full space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      Atualizando a cada 5s
                    </span>
                    <span className={cn('font-mono font-semibold', timeLeft <= 15 ? 'text-destructive' : 'text-muted-foreground')}>
                      {timeLeft}s
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000',
                        timeLeft <= 15 ? 'bg-destructive' : timeLeft <= 30 ? 'bg-warning' : 'bg-[#25D366]'
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <Button size="sm" className="w-full" loading={connectInstance.isPending}
                  onClick={() => connectInstance.mutateAsync(instance.id)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Gerar novo QR code
                </Button>
              )}

              {/* Steps */}
              <div className="w-full rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-foreground mb-2">Como escanear:</p>
                <div className="space-y-1.5">
                  {[
                    'Abra o WhatsApp no celular',
                    'Toque em ⋮ → Dispositivos conectados',
                    'Toque em "Conectar um dispositivo"',
                    'Aponte a câmera para o QR code acima',
                  ].map((text, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-[#25D366]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-[#25D366]">{i + 1}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── LOADING ── */
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-muted" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#25D366] animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Gerando QR code...</p>
                <p className="text-xs text-muted-foreground mt-1">Conectando ao servidor Evolution</p>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Instance Form Dialog ──────────────────────────────────────
const instanceSchema = z.object({
  display_name: z.string().min(1, 'Obrigatório'),
  instance_name: z.string()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[a-z0-9_-]+$/, 'Apenas letras minúsculas, números, _ e -'),
  provider: z.enum(['evolution_api', 'evolution_go']),
  server_url: z.string().url('URL inválida'),
  api_key: z.string().min(1, 'Obrigatório'),
  auto_reply: z.boolean(),
})

type InstanceValues = z.infer<typeof instanceSchema>

function InstanceFormDialog({
  open, onClose, editing,
}: { open: boolean; onClose: () => void; editing?: EvolutionInstance }) {
  const createInstance = useCreateInstance()
  const updateInstance = useUpdateInstance()
  const [showKey, setShowKey] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<InstanceValues>({
    resolver: zodResolver(instanceSchema),
    defaultValues: {
      display_name: '',
      instance_name: '',
      provider: 'evolution_api',
      server_url: '',
      api_key: '',
      auto_reply: true,
    },
  })

  // Sempre que o modal abre (ou o editing muda), recarrega os valores da instância correta
  useEffect(() => {
    if (!open) return
    reset({
      display_name:  editing?.display_name  ?? '',
      instance_name: editing?.instance_name ?? '',
      provider:      editing?.provider      ?? 'evolution_api',
      server_url:    editing?.server_url    ?? '',
      api_key:       editing?.api_key       ?? '',
      auto_reply:    editing?.auto_reply    ?? true,
    })
    setShowKey(false)
  }, [open, editing?.id])   // usa editing.id como dep — muda apenas quando é outra instância

  const autoReply = watch('auto_reply')
  const currentProvider = watch('provider') as EvolutionProvider

  // Ao trocar de provider, limpa URL e chave para não contaminar entre tipos
  function handleProviderChange(p: EvolutionProvider) {
    if (p === currentProvider) return
    setValue('provider', p, { shouldValidate: false })
    setValue('server_url', '', { shouldValidate: false })
    setValue('api_key',    '', { shouldValidate: false })
  }

  const providerDocs: Record<EvolutionProvider, { name: string; docUrl: string; authLabel: string; authPlaceholder: string; color: string }> = {
    evolution_api: {
      name: 'Evolution API',
      docUrl: 'https://doc.evolution-api.com',
      authLabel: 'API Key (apikey header)',
      authPlaceholder: 'sua-api-key-aqui',
      color: 'text-green-500',
    },
    evolution_go: {
      name: 'Evolution GO',
      docUrl: 'https://github.com/evolution-go/evolution-go',
      authLabel: 'Bearer Token (Authorization header)',
      authPlaceholder: 'seu-bearer-token',
      color: 'text-blue-500',
    },
  }

  const doc = providerDocs[currentProvider as EvolutionProvider] ?? providerDocs.evolution_api

  const onSubmit = async (values: InstanceValues) => {
    if (editing) {
      await updateInstance.mutateAsync({ id: editing.id, ...values })
    } else {
      await createInstance.mutateAsync(values)
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-success" />
            {editing ? 'Editar instância' : 'Nova instância WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            Configure a conexão com seu servidor Evolution.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            {/* Provider selector */}
            <div className="space-y-2">
              <Label>Provedor *</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['evolution_api', 'evolution_go'] as EvolutionProvider[]).map(p => {
                  const d = providerDocs[p]
                  const isSelected = currentProvider === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProviderChange(p)}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-all',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2.5 w-2.5 rounded-full', isSelected ? 'bg-primary' : 'bg-muted-foreground')} />
                        <span className={cn('text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                          {d.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {p === 'evolution_api' ? 'Node.js · REST API · Open source' : 'Go lang · Alta performance · Webhook'}
                      </p>
                      <a href={d.docUrl} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                        Docs <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome de exibição *</Label>
                <Input placeholder="Ex: WhatsApp Vendas" {...register('display_name')} />
                {errors.display_name && <p className="text-xs text-destructive">{errors.display_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Nome da instância *</Label>
                <Input placeholder="vendas-principal" {...register('instance_name')} />
                {errors.instance_name && <p className="text-xs text-destructive">{errors.instance_name.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                URL do servidor *
              </Label>
              <Input
                placeholder={currentProvider === 'evolution_api' ? 'https://evolution.suaempresa.com' : 'https://evo-go.suaempresa.com'}
                {...register('server_url')}
              />
              {errors.server_url && <p className="text-xs text-destructive">{errors.server_url.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                {doc.authLabel} *
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={doc.authPlaceholder}
                  className="pr-10"
                  {...register('api_key')}
                />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.api_key && <p className="text-xs text-destructive">{errors.api_key.message}</p>}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-accent" />
                  <Label className="text-sm font-medium">IA responde automaticamente</Label>
                </div>
                <p className="text-xs text-muted-foreground">Quando ativo, o agente IA responde novas mensagens (debounce 4s)</p>
              </div>
              <Switch checked={autoReply} onCheckedChange={v => setValue('auto_reply', v)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Salvar' : 'Criar instância'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Instance Card ─────────────────────────────────────────────
function InstanceCard({ instance }: { instance: EvolutionInstance }) {
  const [qrOpen, setQrOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  const connectInstance = useConnectInstance()
  const disconnectInstance = useDisconnectInstance()
  const refreshStatus = useRefreshStatus()
  const setWebhook = useSetWebhook()
  const deleteInstance = useDeleteInstance()
  const updateInstance = useUpdateInstance()
  const { data: creds = [] } = useAICredentials()

  const activeAICred = creds.find(c => c.is_active)
  const aiLabel = activeAICred ? (PROVIDER_LABELS[activeAICred.provider] ?? activeAICred.provider) : null

  const status = STATUS_CONFIG[instance.status] ?? STATUS_CONFIG.disconnected
  const StatusIcon = status.icon

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook?provider=${instance.provider}`

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = async () => {
    await connectInstance.mutateAsync(instance.id)
    setQrOpen(true)
  }

  return (
    <>
      <Card className={cn(
        'transition-all',
        instance.status === 'connected' && 'border-success/30',
        instance.status === 'error' && 'border-destructive/30',
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
              instance.status === 'connected' ? 'bg-success/15' : 'bg-muted'
            )}>
              <Phone className={cn('h-5 w-5', instance.status === 'connected' ? 'text-success' : 'text-muted-foreground')} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base truncate">
                  {instance.display_name ?? instance.instance_name}
                </CardTitle>
                <Badge
                  variant={instance.provider === 'evolution_go' ? 'secondary' : 'outline'}
                  className="text-[10px] shrink-0"
                >
                  {instance.provider === 'evolution_go' ? 'GO' : 'API'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{instance.instance_name}</p>
            </div>

            {/* Status chip */}
            <div className={cn('flex items-center gap-1.5 text-xs font-medium shrink-0', status.color)}>
              <StatusIcon className={cn('h-3.5 w-3.5', status.pulse && 'animate-spin')} />
              {status.label}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-4">
          {/* Info */}
          <div className="space-y-1">
            {instance.phone_number && (
              <div className="flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground font-medium">{instance.phone_number}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <Globe className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{instance.server_url}</span>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="rounded-lg bg-muted/40 p-2 flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground flex-1 truncate font-mono">{webhookUrl}</p>
            <button onClick={copyWebhook} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {instance.error_message && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{instance.error_message}</p>
            </div>
          )}

          {/* Agente de IA */}
          <div className={cn(
            'rounded-xl border p-3 space-y-2 transition-colors',
            instance.auto_reply && activeAICred ? 'border-violet-200 bg-violet-50/50' : 'border-border'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className={cn('h-3.5 w-3.5', instance.auto_reply ? 'text-violet-600' : 'text-muted-foreground')} />
                <span className="text-xs font-medium text-foreground">Agente de IA</span>
                {instance.auto_reply && aiLabel && (
                  <span className="text-[9px] rounded-full px-1.5 py-0.5 bg-violet-100 text-violet-700 font-semibold border border-violet-200">
                    {aiLabel}
                  </span>
                )}
              </div>
              <Switch
                checked={instance.auto_reply}
                onCheckedChange={v => updateInstance.mutate({ id: instance.id, auto_reply: v })}
              />
            </div>
            {instance.auto_reply && (
              activeAICred ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-xs text-muted-foreground">Respondendo automaticamente</span>
                  </div>
                  <a href="/admin/agents" className="text-[10px] text-violet-600 font-medium hover:underline">
                    Configurar →
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 text-warning-foreground flex-shrink-0" />
                  <a href="/admin/agents" className="text-xs text-warning-foreground hover:underline">
                    Adicione uma API key em Agentes IA
                  </a>
                </div>
              )
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-1">
            {instance.status === 'connected' ? (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
                loading={disconnectInstance.isPending}
                onClick={() => disconnectInstance.mutate(instance.id)}>
                <WifiOff className="h-3.5 w-3.5" /> Desconectar
              </Button>
            ) : (
              <Button size="sm" loading={connectInstance.isPending} onClick={handleConnect}>
                <QrCode className="h-3.5 w-3.5" /> Conectar (QR)
              </Button>
            )}

            <Button variant="outline" size="sm"
              loading={refreshStatus.isPending}
              onClick={() => refreshStatus.mutate(instance.id)}>
              <RefreshCw className="h-3.5 w-3.5" /> Status
            </Button>

            <Button variant="outline" size="sm"
              loading={setWebhook.isPending}
              onClick={() => setWebhook.mutate(instance.id)}>
              <Zap className="h-3.5 w-3.5" /> Webhook
            </Button>

            <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>

          {instance.last_sync_at && (
            <p className="text-[10px] text-muted-foreground">
              Última sync: {new Date(instance.last_sync_at).toLocaleString('pt-BR')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* QR Modal */}
      {qrOpen && (
        <QRCodeModal instance={instance} open={qrOpen} onClose={() => setQrOpen(false)} />
      )}

      {/* Edit Dialog */}
      {editOpen && (
        <InstanceFormDialog key={instance.id} open={editOpen} onClose={() => setEditOpen(false)} editing={instance} />
      )}

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir instância?</DialogTitle>
            <DialogDescription>
              A instância <strong>{instance.display_name}</strong> será removida. O histórico de conversas é preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" loading={deleteInstance.isPending}
              onClick={async () => {
                await deleteInstance.mutateAsync(instance.id)
                setDeleteConfirm(false)
              }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── AI Status Banner ──────────────────────────────────────────
function AIStatusBanner() {
  const { data: creds = [] } = useAICredentials()
  const activeCreds = creds.filter(c => c.is_active)
  const { data: instances = [] } = useEvolutionInstances()
  const aiActiveCount = instances.filter(i => i.auto_reply).length

  return (
    <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Agente de IA</p>
            <div className="flex items-center gap-3 mt-0.5">
              {activeCreds.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {activeCreds.map(c => PROVIDER_LABELS[c.provider] ?? c.provider).join(', ')} configurado{activeCreds.length > 1 ? 's' : ''}
                  {aiActiveCount > 0 && ` · ${aiActiveCount} instância${aiActiveCount > 1 ? 's' : ''} com IA ativa`}
                </span>
              ) : (
                <span className="text-xs text-warning-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Nenhuma API key configurada
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeCreds.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-success font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Ativo
              </div>
            )}
            <a href="/admin/agents">
              <Button variant="outline" size="sm" className="text-violet-700 border-violet-300 hover:bg-violet-100">
                <Bot className="h-3.5 w-3.5" /> Gerenciar Agentes
              </Button>
            </a>
          </div>
        </div>
        {activeCreds.length > 0 && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-violet-200/60">
            {activeCreds.map(c => (
              <span key={c.provider} className="flex items-center gap-1.5 text-[10px] rounded-full px-2.5 py-1 bg-white border border-violet-200 text-violet-700 font-medium shadow-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-success" />
                {PROVIDER_LABELS[c.provider] ?? c.provider}
              </span>
            ))}
            {creds.filter(c => !c.is_active).length > 0 && (
              <span className="text-[10px] text-muted-foreground self-center ml-1">
                + {creds.filter(c => !c.is_active).length} sem chave
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  WhatsAppPage                                            ║
// ╚══════════════════════════════════════════════════════════╝
export function WhatsAppPage() {
  const { data: instances = [], isLoading } = useEvolutionInstances()
  const [createOpen, setCreateOpen] = useState(false)
  const [filterProvider, setFilterProvider] = useState<'all' | 'evolution_api' | 'evolution_go'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected'>('all')

  const filtered = instances.filter(i => {
    if (filterProvider !== 'all' && i.provider !== filterProvider) return false
    if (filterStatus === 'connected' && i.status !== 'connected') return false
    if (filterStatus === 'disconnected' && i.status === 'connected') return false
    return true
  })

  const connectedCount = instances.filter(i => i.status === 'connected').length
  const totalMessages = instances.reduce((acc, i) => acc + (i.last_message_at ? 1 : 0), 0)

  const webhookBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie instâncias Evolution API e Evolution GO em uma única interface.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova instância
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total de instâncias', value: instances.length, icon: Phone, color: 'text-primary' },
          { label: 'Conectadas', value: connectedCount, icon: Wifi, color: 'text-success' },
          { label: 'Evolution API', value: instances.filter(i => i.provider === 'evolution_api').length, icon: Zap, color: 'text-green-500' },
          { label: 'Evolution GO', value: instances.filter(i => i.provider === 'evolution_go').length, icon: Zap, color: 'text-blue-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Webhook info box */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-1">URL base do Webhook</p>
              <p className="text-xs text-muted-foreground mb-2">
                Configure esta URL no seu servidor Evolution. O provider é detectado automaticamente.
              </p>
              <div className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2">
                <code className="text-xs text-foreground flex-1 truncate font-mono">{webhookBaseUrl}</code>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span>Evolution API: <code className="text-foreground">?provider=evolution_api</code></span>
                <span>Evolution GO: <code className="text-foreground">?provider=evolution_go</code></span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Agent Banner */}
      <AIStatusBanner />

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'evolution_api', label: 'Evolution API' },
            { value: 'evolution_go', label: 'Evolution GO' },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => setFilterProvider(opt.value as typeof filterProvider)}
              className={cn(
                'text-xs rounded-full px-3 py-1 border transition-colors',
                filterProvider === opt.value
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
              )}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 ml-4">
          {[
            { value: 'all', label: 'Qualquer status' },
            { value: 'connected', label: '🟢 Conectadas' },
            { value: 'disconnected', label: '⚫ Desconectadas' },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => setFilterStatus(opt.value as typeof filterStatus)}
              className={cn(
                'text-xs rounded-full px-3 py-1 border transition-colors',
                filterStatus === opt.value
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
              )}>
              {opt.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} instância{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid de instâncias */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-xl bg-card animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Phone className="h-7 w-7 text-primary" />
            </div>
            <p className="font-medium text-foreground">Nenhuma instância configurada</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Crie sua primeira instância conectando um número WhatsApp via Evolution API ou Evolution GO.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="mt-2">
              <Plus className="h-4 w-4" /> Criar primeira instância
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(instance => (
            <InstanceCard key={instance.id} instance={instance} />
          ))}
        </div>
      )}

      <InstanceFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

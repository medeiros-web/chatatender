import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, Copy, ExternalLink, Settings, TrendingUp, ShoppingCart,
  RefreshCw, XCircle, CheckCircle2, AlertCircle, Link2, DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import {
  usePaymentIntegrations, useSavePaymentIntegration,
  usePaymentLinks, useCreatePaymentLink, useUpdatePaymentLink,
  usePaymentTransactions, usePaymentStats,
  getWebhookUrl,
} from '@/hooks/usePayments'
import type { PaymentLink, PaymentTransaction } from '@/hooks/usePayments'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: 'cakto',   label: 'Cakto',   color: '#8B5CF6' },
  { value: 'hotmart', label: 'Hotmart', color: '#FF6B00' },
  { value: 'doppus',  label: 'Doppus',  color: '#0EA5E9' },
] as const

const CREDENTIAL_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  cakto: [
    { key: 'webhook_token', label: 'Webhook Token', placeholder: 'token secreto do Cakto' },
  ],
  hotmart: [
    { key: 'hottok',        label: 'Hottok',        placeholder: 'seu hottok do Hotmart' },
    { key: 'client_id',     label: 'Client ID',     placeholder: 'OAuth client_id (opcional)' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'OAuth client_secret (opcional)' },
  ],
  doppus: [
    { key: 'webhook_secret', label: 'Webhook Secret (HMAC)', placeholder: 'chave secreta HMAC' },
    { key: 'api_key',        label: 'API Key',               placeholder: 'chave de API Doppus' },
  ],
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
}

// ── Integration Config Dialog ─────────────────────────────────────────────────

function IntegrationDialog({
  provider, open, onClose,
}: {
  provider: typeof PROVIDERS[number]['value']
  open: boolean
  onClose: () => void
}) {
  const { data: integrations = [] } = usePaymentIntegrations()
  const save = useSavePaymentIntegration()
  const existing = integrations.find(i => i.provider === provider)
  const fields = CREDENTIAL_FIELDS[provider] ?? []

  const [creds, setCreds] = useState<Record<string, string>>(
    existing?.credentials ?? {}
  )
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)

  const providerLabel = PROVIDERS.find(p => p.value === provider)?.label ?? provider

  const handleSave = async () => {
    await save.mutateAsync({ provider, credentials: creds, is_active: isActive })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar {providerLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key} className="space-y-1">
              <label className="text-sm font-medium">{f.label}</label>
              <Input
                type="password"
                placeholder={f.placeholder}
                value={creds[f.key] ?? ''}
                onChange={e => setCreds(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <label className="text-sm">Integração ativa</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Create Link Dialog ────────────────────────────────────────────────────────

const linkSchema = z.object({
  title: z.string().min(2),
  url: z.string().url('URL inválida'),
  provider: z.enum(['cakto','hotmart','doppus','manual']),
  amount: z.string().optional(),
})

type LinkForm = z.infer<typeof linkSchema>

function CreateLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreatePaymentLink()
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LinkForm>({
    resolver: zodResolver(linkSchema),
    defaultValues: { provider: 'manual' },
  })

  const onSubmit = async (values: LinkForm) => {
    const amountCents = values.amount
      ? Math.round(parseFloat(values.amount.replace(',', '.')) * 100)
      : undefined
    await create.mutateAsync({
      title: values.title,
      url: values.url,
      provider: values.provider,
      amount_cents: amountCents ?? null,
      lead_id: null,
      product_id: null,
      external_id: null,
      currency: 'BRL',
      status: 'active',
      expires_at: null,
      metadata: {},
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Link de Pagamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Título *</label>
            <Input {...register('title')} placeholder="Ex: Plano Anual Premium" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">URL *</label>
            <Input {...register('url')} placeholder="https://pay.cakto.com.br/..." />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Plataforma</label>
              <Select
                value={watch('provider')}
                onValueChange={v => setValue('provider', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input {...register('amount')} placeholder="297,00" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Criando...' : 'Criar Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow() {
  const { data: stats } = usePaymentStats()

  const cards = [
    {
      label: 'Receita (30d)',
      value: formatBRL(stats?.revenue_cents),
      icon: DollarSign,
      color: 'text-success',
    },
    {
      label: 'Aprovadas',
      value: stats?.approved_count ?? '—',
      icon: CheckCircle2,
      color: 'text-success',
    },
    {
      label: 'Abandonadas',
      value: stats?.abandoned_count ?? '—',
      icon: ShoppingCart,
      color: 'text-warning',
    },
    {
      label: 'Estornos',
      value: stats?.refunded_count ?? '—',
      icon: RefreshCw,
      color: 'text-destructive',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </div>
          <p className="text-xl font-bold">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Integrations Tab ──────────────────────────────────────────────────────────

function IntegrationsTab() {
  const { organizationId } = useAuth()
  const { data: integrations = [] } = usePaymentIntegrations()
  const [configProvider, setConfigProvider] = useState<typeof PROVIDERS[number]['value'] | null>(null)

  const copyWebhook = (provider: typeof PROVIDERS[number]['value']) => {
    if (!organizationId) return
    navigator.clipboard.writeText(getWebhookUrl(organizationId, provider))
  }

  return (
    <div className="space-y-3">
      {PROVIDERS.map(p => {
        const int = integrations.find(i => i.provider === p.value)
        return (
          <div key={p.value} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
            <div
              className="w-2 h-10 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{p.label}</span>
                {int?.is_active && (
                  <Badge variant="secondary" className="text-xs bg-success/15 text-success">Ativo</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {int ? 'Credenciais configuradas' : 'Não configurado'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {int?.is_active && (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => copyWebhook(p.value)}
                >
                  <Copy className="h-3 w-3" /> Webhook URL
                </Button>
              )}
              <Button
                size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => setConfigProvider(p.value)}
              >
                <Settings className="h-3.5 w-3.5" />
                {int ? 'Editar' : 'Configurar'}
              </Button>
            </div>
          </div>
        )
      })}

      {configProvider && (
        <IntegrationDialog
          provider={configProvider}
          open={true}
          onClose={() => setConfigProvider(null)}
        />
      )}

      <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Como usar os webhooks</p>
        <p>1. Configure as credenciais de cada plataforma acima.</p>
        <p>2. Copie a "Webhook URL" gerada para cada integração.</p>
        <p>3. Cole essa URL no painel da plataforma de pagamento.</p>
        <p>4. Cada venda aprovada/estorno criará automaticamente um lead e aplicará as etiquetas configuradas.</p>
      </div>
    </div>
  )
}

// ── Links Tab ─────────────────────────────────────────────────────────────────

const LINK_STATUS_STYLE: Record<PaymentLink['status'], string> = {
  active:    'bg-primary/15 text-primary',
  expired:   'bg-muted text-muted-foreground',
  paid:      'bg-success/15 text-success',
  cancelled: 'bg-destructive/15 text-destructive',
}

const LINK_STATUS_LABEL: Record<PaymentLink['status'], string> = {
  active:    'Ativo',
  expired:   'Expirado',
  paid:      'Pago',
  cancelled: 'Cancelado',
}

function LinksTab() {
  const { data: links = [], isLoading } = usePaymentLinks()
  const update = useUpdatePaymentLink()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Link
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {links.map(link => (
        <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{link.title}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${LINK_STATUS_STYLE[link.status]}`}>
                {LINK_STATUS_LABEL[link.status]}
              </span>
              <Badge variant="secondary" className="text-xs capitalize">{link.provider}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{formatBRL(link.amount_cents)}</span>
              {link.leads && <span>Lead: {(link.leads as any).name}</span>}
              <span>{format(parseISO(link.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => navigator.clipboard.writeText(link.url)}
              title="Copiar link"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => window.open(link.url, '_blank')}
              title="Abrir"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            {link.status === 'active' && (
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                onClick={() => update.mutate({ id: link.id, status: 'cancelled' })}
                title="Cancelar"
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {!isLoading && links.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum link de pagamento ainda.</p>
        </div>
      )}

      <CreateLinkDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

// ── Transactions Tab ──────────────────────────────────────────────────────────

const TX_STATUS_ICON: Record<PaymentTransaction['status'], { icon: typeof CheckCircle2; cls: string }> = {
  pending:    { icon: AlertCircle,    cls: 'text-muted-foreground' },
  approved:   { icon: CheckCircle2,  cls: 'text-success' },
  refunded:   { icon: RefreshCw,     cls: 'text-warning' },
  chargeback: { icon: XCircle,       cls: 'text-destructive' },
  abandoned:  { icon: ShoppingCart,  cls: 'text-muted-foreground' },
}

const TX_STATUS_LABEL: Record<PaymentTransaction['status'], string> = {
  pending:    'Pendente',
  approved:   'Aprovada',
  refunded:   'Estornada',
  chargeback: 'Chargeback',
  abandoned:  'Abandonada',
}

const EVENT_LABEL: Record<string, string> = {
  compra_aprovada:    'Compra aprovada',
  reembolso:          'Reembolso',
  checkout_abandonado:'Checkout abandonado',
  pix_gerado:         'PIX gerado',
  boleto_gerado:      'Boleto gerado',
  chargeback:         'Chargeback',
}

function TransactionsTab() {
  const [provider, setProvider] = useState<string>('')
  const { data: txs = [], isLoading } = usePaymentTransactions({
    provider: provider || undefined,
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={provider || '__all__'} onValueChange={v => setProvider(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todas plataformas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {PROVIDERS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{txs.length} transações</span>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {txs.map(tx => {
          const { icon: Icon, cls } = TX_STATUS_ICON[tx.status]
          return (
            <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <Icon className={`h-4 w-4 flex-shrink-0 ${cls}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {EVENT_LABEL[tx.event_type] ?? tx.event_type}
                  </span>
                  <Badge variant="secondary" className="text-xs capitalize">{tx.provider}</Badge>
                  <span className="text-xs text-muted-foreground">{TX_STATUS_LABEL[tx.status]}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  {tx.buyer_name && <span>{tx.buyer_name}</span>}
                  {tx.buyer_email && <span>{tx.buyer_email}</span>}
                  {tx.leads && <span>Lead: {(tx.leads as any).name}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatBRL(tx.amount_cents)}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(tx.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          )
        })}
        {!isLoading && txs.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma transação registrada.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PaymentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display">Integrações de Pagamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte Cakto, Hotmart e Doppus para capturar vendas e disparar automações.
        </p>
      </div>

      <StatsRow />

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations">Plataformas</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <LinksTab />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

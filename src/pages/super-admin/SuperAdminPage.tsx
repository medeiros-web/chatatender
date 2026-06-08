import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useSAStats, useSAOrganizations, useToggleOrganization,
  useSAUsers, useSetUserStatus, usePlans, useUpsertPlan, useDeletePlan,
  useSASubscriptions, useUpdateSubscription,
  usePlatformSettings, useUpdatePlatformSetting,
  useReleases, useUpsertRelease, useDeleteRelease,
  useHelpArticles, useUpsertHelpArticle, useDeleteHelpArticle,
  useSupportTickets, useUpdateTicket,
  useAuditLogs,
  useSystemHealth, useRunHealthChecks,
  useAgentToolExecutions,
} from '@/hooks/useSuperAdmin'
import type {
  Plan, Release, HelpArticle, SupportTicket, Subscription,
} from '@/hooks/useSuperAdmin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  Building2, Users, CreditCard, TrendingUp, Activity,
  Plus, Trash2, Edit2, CheckCircle2, XCircle, RefreshCw,
  Eye, EyeOff, Copy, ChevronDown, ExternalLink, AppWindow,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Utils ──────────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return format(new Date(iso), 'dd/MM/yyyy')
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── Status badges ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:      'bg-emerald-100 text-emerald-700',
    trialing:    'bg-blue-100 text-blue-700',
    past_due:    'bg-amber-100 text-amber-700',
    cancelled:   'bg-red-100 text-red-700',
    paused:      'bg-slate-100 text-slate-600',
    open:        'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    waiting:     'bg-violet-100 text-violet-700',
    resolved:    'bg-emerald-100 text-emerald-700',
    closed:      'bg-slate-100 text-slate-600',
    ok:          'bg-emerald-100 text-emerald-700',
    degraded:    'bg-amber-100 text-amber-700',
    down:        'bg-red-100 text-red-700',
    urgent:      'bg-red-100 text-red-700',
    high:        'bg-orange-100 text-orange-700',
    normal:      'bg-slate-100 text-slate-600',
    low:         'bg-green-100 text-green-700',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', map[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

function Table({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {heads.map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

function Tr({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr className={cn('bg-card hover:bg-accent/50 transition-colors', onClick && 'cursor-pointer')} onClick={onClick}>
      {children}
    </tr>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-sm text-foreground', className)}>{children}</td>
}

// ── Apps Quick Access ─────────────────────────────────────────────────────────

const SA_APP_LINKS = [
  { label: 'Painel.chatatender.ia.br',        href: 'https://painel.chatatender.ia.br' },
  { label: 'ia.chatatender.com.br',           href: 'https://ia.chatatender.com.br' },
  { label: 'webhook.chatatender.ia.br/login', href: 'https://webhook.chatatender.ia.br/login' },
  { label: 'ia.advogadosdefesa.com.br',       href: 'https://ia.advogadosdefesa.com.br' },
]

function SAQuickAccessApps() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Acesso rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-accent transition-colors text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500">
                <AppWindow className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground leading-tight">APPs (Agente de IA)</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {SA_APP_LINKS.map(app => (
              <DropdownMenuItem key={app.href} asChild>
                <a href={app.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="text-xs truncate">{app.label}</span>
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function SADashboard() {
  const { data: stats, isLoading } = useSAStats()
  const { data: orgs = [] } = useSAOrganizations()
  const recentOrgs = orgs.slice(0, 5)

  const kpis = [
    { label: 'Organizações',      value: stats?.totalOrgs ?? 0,            icon: Building2,   color: 'bg-blue-500' },
    { label: 'Ativas',            value: stats?.activeOrgs ?? 0,           icon: CheckCircle2, color: 'bg-emerald-500' },
    { label: 'Usuários',          value: stats?.totalUsers ?? 0,           icon: Users,        color: 'bg-violet-500' },
    { label: 'Assinaturas ativas',value: stats?.activeSubscriptions ?? 0,  icon: CreditCard,   color: 'bg-amber-500' },
    { label: 'Tickets abertos',   value: stats?.openTickets ?? 0,          icon: Activity,     color: 'bg-rose-500' },
  ]

  return (
    <Section title="Visão geral da plataforma">
      <SAQuickAccessApps />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', k.color)}>
                <k.icon className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                {isLoading ? <Skeleton className="h-6 w-12 mt-0.5" /> : <p className="font-display text-xl font-bold">{k.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Organizações recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentOrgs.map(org => (
              <div key={org.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent">
                <div className="h-7 w-7 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{org.name}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(org.created_at)}</p>
                </div>
                <StatusBadge status={org.is_active ? 'active' : 'cancelled'} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição por plano</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground py-8 text-center">
              Dados de assinaturas disponíveis após aplicar a migration.
            </p>
          </CardContent>
        </Card>
      </div>
    </Section>
  )
}

// ── Organizations ─────────────────────────────────────────────────────────────

export function SAOrganizations() {
  const { data: orgs = [], isLoading } = useSAOrganizations()
  const toggle = useToggleOrganization()
  const [search, setSearch] = useState('')

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Section title={`Organizações (${orgs.length})`}>
      <Input placeholder="Buscar organização..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      {isLoading
        ? <Skeleton className="h-64 w-full" />
        : (
          <Table heads={['Organização', 'Slug', 'Plano', 'Status', 'Criada', 'Ações']}>
            {filtered.map(org => (
              <Tr key={org.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(org.name)}</AvatarFallback></Avatar>
                    <span className="font-medium">{org.name}</span>
                  </div>
                </Td>
                <Td className="text-muted-foreground font-mono text-xs">{org.slug}</Td>
                <Td>{org.subscriptions?.[0]?.plans?.name ?? <span className="text-muted-foreground text-xs">Sem plano</span>}</Td>
                <Td><StatusBadge status={org.is_active ? 'active' : 'cancelled'} /></Td>
                <Td className="text-muted-foreground text-xs">{timeAgo(org.created_at)}</Td>
                <Td>
                  <Button
                    variant="ghost" size="sm"
                    className={org.is_active ? 'text-destructive hover:text-destructive' : 'text-emerald-600'}
                    onClick={() => toggle.mutate({ id: org.id, is_active: !org.is_active })}
                  >
                    {org.is_active ? 'Desativar' : 'Ativar'}
                  </Button>
                </Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function SAUsers() {
  const { data: users = [], isLoading } = useSAUsers()
  const setStatus = useSetUserStatus()
  const [search, setSearch] = useState('')

  const pending  = users.filter(u => u.status === 'pending')
  const filtered = users.filter(u =>
    u.status !== 'pending' &&
    ((u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* ── Pendentes de aprovação ── */}
      {pending.length > 0 && (
        <Section title={`⏳ Aguardando aprovação (${pending.length})`}>
          <Table heads={['Usuário', 'Email', 'Cadastro', 'Ações']}>
            {pending.map(u => (
              <Tr key={u.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(u.full_name)}</AvatarFallback></Avatar>
                    <span>{u.full_name ?? '—'}</span>
                  </div>
                </Td>
                <Td className="text-muted-foreground text-xs">{u.email}</Td>
                <Td className="text-muted-foreground text-xs">{timeAgo(u.created_at)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
                      onClick={() => setStatus.mutate({ userId: u.id, status: 'active' })}
                      disabled={setStatus.isPending}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 gap-1 text-xs px-3"
                      onClick={() => setStatus.mutate({ userId: u.id, status: 'rejected' })}
                      disabled={setStatus.isPending}
                    >
                      <XCircle className="h-3 w-3" /> Rejeitar
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        </Section>
      )}

      {/* ── Todos os usuários ── */}
      <Section title={`Todos os usuários (${users.length - pending.length})`}>
        <Input placeholder="Buscar usuário..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        {isLoading
          ? <Skeleton className="h-64 w-full" />
          : (
            <Table heads={['Usuário', 'Email', 'Organização', 'Role', 'Status', 'Cadastro', 'Ações']}>
              {filtered.map(u => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(u.full_name)}</AvatarFallback></Avatar>
                      <span>{u.full_name ?? '—'}</span>
                    </div>
                  </Td>
                  <Td className="text-muted-foreground text-xs">{u.email}</Td>
                  <Td className="text-xs">{u.org_name ?? '—'}</Td>
                  <Td><Badge variant="outline" className="text-[10px]">{u.role ?? '—'}</Badge></Td>
                  <Td><StatusBadge status={u.status} /></Td>
                  <Td className="text-muted-foreground text-xs">{timeAgo(u.created_at)}</Td>
                  <Td>
                    {u.status === 'active' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                        onClick={() => setStatus.mutate({ userId: u.id, status: 'suspended' })}
                        disabled={setStatus.isPending}>
                        Suspender
                      </Button>
                    )}
                    {(u.status === 'suspended' || u.status === 'rejected') && (
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                        onClick={() => setStatus.mutate({ userId: u.id, status: 'active' })}
                        disabled={setStatus.isPending}>
                        Reativar
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          )
        }
      </Section>
    </div>
  )
}

// ── Plans ─────────────────────────────────────────────────────────────────────

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  price_monthly: z.number(),
  price_annual: z.number(),
  max_users: z.number(),
  max_agents: z.number(),
  max_leads: z.number(),
  max_products: z.number(),
  features: z.string(),
  is_active: z.boolean().optional(),
  sort_order: z.number(),
})
type PlanForm = z.infer<typeof planSchema>

function PlanDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Plan | null }) {
  const upsert = useUpsertPlan()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      id: editing?.id ?? undefined,
      name: editing?.name ?? '',
      slug: editing?.slug ?? '',
      description: editing?.description ?? '',
      price_monthly: editing?.price_monthly ?? 0,
      price_annual: editing?.price_annual ?? 0,
      max_users: editing?.max_users ?? 5,
      max_agents: editing?.max_agents ?? 1,
      max_leads: editing?.max_leads ?? 1000,
      max_products: editing?.max_products ?? 10,
      features: editing ? (editing.features ?? []).join('\n') : '',
      is_active: editing?.is_active ?? true,
      sort_order: editing?.sort_order ?? 0,
    },
  })

  const onSubmit = async (data: PlanForm) => {
    await upsert.mutateAsync({
      ...data,
      features: data.features.split('\n').map(s => s.trim()).filter(Boolean),
    })
    onClose(); reset()
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Editar plano' : 'Novo plano'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Nome</label>
              <Input {...register('name')} className="mt-1" />
              {errors.name && <p className="text-[10px] text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium">Slug</label>
              <Input {...register('slug')} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Descrição</label>
            <Input {...register('description')} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Preço/mês (R$)</label>
              <Input type="number" {...register('price_monthly', { valueAsNumber: true })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium">Preço/ano (R$)</label>
              <Input type="number" {...register('price_annual', { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Máx. usuários</label>
              <Input type="number" {...register('max_users', { valueAsNumber: true })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium">Máx. agentes IA</label>
              <Input type="number" {...register('max_agents', { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Máx. leads</label>
              <Input type="number" {...register('max_leads', { valueAsNumber: true })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium">Ordem</label>
              <Input type="number" {...register('sort_order', { valueAsNumber: true })} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Features (uma por linha)</label>
            <Textarea {...register('features')} rows={4} className="mt-1 font-mono text-xs" placeholder="WhatsApp&#10;CRM&#10;Funis" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SAPlans() {
  const { data: plans = [], isLoading } = usePlans()
  const deletePlan = useDeletePlan()
  const [editing, setEditing] = useState<Plan | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <Section title="Planos & Preços" action={
      <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>
        <Plus className="h-3.5 w-3.5" /> Novo plano
      </Button>
    }>
      <PlanDialog open={open} onClose={() => setOpen(false)} editing={editing} />
      {isLoading
        ? <Skeleton className="h-48 w-full" />
        : (
          <Table heads={['Plano', 'Preço/mês', 'Preço/ano', 'Limites', 'Features', 'Status', 'Ações']}>
            {plans.map(plan => (
              <Tr key={plan.id}>
                <Td>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{plan.slug}</p>
                </Td>
                <Td>{fmt(plan.price_monthly)}</Td>
                <Td>{fmt(plan.price_annual)}</Td>
                <Td className="text-xs text-muted-foreground">
                  {plan.max_users}u · {plan.max_agents}ag · {plan.max_leads.toLocaleString()}l
                </Td>
                <Td className="text-xs">{(plan.features ?? []).length} features</Td>
                <Td><StatusBadge status={plan.is_active ? 'active' : 'cancelled'} /></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(plan); setOpen(true) }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => deletePlan.mutate(plan.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export function SASubscriptions() {
  const { data: subs = [], isLoading } = useSASubscriptions()
  const updateSub = useUpdateSubscription()

  return (
    <Section title={`Assinaturas (${subs.length})`}>
      {isLoading
        ? <Skeleton className="h-64 w-full" />
        : (
          <Table heads={['Organização', 'Plano', 'Status', 'Período', 'Provider', 'Ações']}>
            {subs.map(sub => (
              <Tr key={sub.id}>
                <Td className="font-medium">{sub.organizations?.name ?? '—'}</Td>
                <Td>{sub.plans?.name ?? <span className="text-muted-foreground">Sem plano</span>}</Td>
                <Td><StatusBadge status={sub.status} /></Td>
                <Td className="text-xs text-muted-foreground">
                  {fmtDate(sub.current_period_start)} → {fmtDate(sub.current_period_end)}
                </Td>
                <Td className="text-xs">{sub.payment_provider ?? '—'}</Td>
                <Td>
                  <select
                    className="text-xs border border-border rounded px-2 py-1 bg-card"
                    value={sub.status}
                    onChange={e => updateSub.mutate({ id: sub.id, status: e.target.value as Subscription['status'] })}
                  >
                    {['trialing','active','past_due','cancelled','paused'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── Billing (placeholder - read-only view) ────────────────────────────────────

export function SABilling() {
  return (
    <Section title="Billing">
      <Card>
        <CardContent className="py-12 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Transações de Billing</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Integre com Stripe ou Hotmart para visualizar transações financeiras aqui.
            Os dados de assinaturas são gerenciados na aba Assinaturas.
          </p>
        </CardContent>
      </Card>
    </Section>
  )
}

// ── Releases ──────────────────────────────────────────────────────────────────

const releaseSchema = z.object({
  id: z.string().optional(),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['major', 'minor', 'patch', 'hotfix']),
  is_published: z.boolean(),
})
type ReleaseForm = z.infer<typeof releaseSchema>

function ReleaseDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Release | null }) {
  const upsert = useUpsertRelease()
  const { register, handleSubmit, reset } = useForm<ReleaseForm>({
    resolver: zodResolver(releaseSchema),
    defaultValues: {
      id: editing?.id,
      version: editing?.version ?? '',
      title: editing?.title ?? '',
      description: editing?.description ?? '',
      type: editing?.type ?? 'minor',
      is_published: editing?.is_published ?? false,
    },
  })

  const onSubmit = async (data: ReleaseForm) => {
    await upsert.mutateAsync({
      ...data,
      published_at: data.is_published ? new Date().toISOString() : null,
    })
    onClose(); reset()
  }

  const typeColors: Record<string, string> = {
    major: 'bg-red-100 text-red-700', minor: 'bg-blue-100 text-blue-700',
    patch: 'bg-green-100 text-green-700', hotfix: 'bg-orange-100 text-orange-700',
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Editar release' : 'Nova release'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Versão</label>
              <Input {...register('version')} placeholder="v1.2.0" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium">Tipo</label>
              <select {...register('type')} className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-card">
                {(['major','minor','patch','hotfix'] as const).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Título</label>
            <Input {...register('title')} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">Descrição (Markdown)</label>
            <Textarea {...register('description')} rows={5} className="mt-1 font-mono text-xs" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register('is_published')} className="h-4 w-4" />
            Publicar agora
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SAReleases() {
  const { data: releases = [], isLoading } = useReleases()
  const deleteRelease = useDeleteRelease()
  const [editing, setEditing] = useState<Release | null>(null)
  const [open, setOpen] = useState(false)

  const typeColors: Record<string, string> = {
    major: 'bg-red-100 text-red-700', minor: 'bg-blue-100 text-blue-700',
    patch: 'bg-green-100 text-green-700', hotfix: 'bg-orange-100 text-orange-700',
  }

  return (
    <Section title="Releases / Changelog" action={
      <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>
        <Plus className="h-3.5 w-3.5" /> Nova release
      </Button>
    }>
      <ReleaseDialog open={open} onClose={() => setOpen(false)} editing={editing} />
      {isLoading
        ? <Skeleton className="h-48 w-full" />
        : (
          <Table heads={['Versão', 'Tipo', 'Título', 'Status', 'Publicado', 'Ações']}>
            {releases.map(r => (
              <Tr key={r.id}>
                <Td className="font-mono font-medium">{r.version}</Td>
                <Td>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', typeColors[r.type] ?? 'bg-muted text-muted-foreground')}>{r.type}</span>
                </Td>
                <Td>{r.title}</Td>
                <Td><StatusBadge status={r.is_published ? 'active' : 'paused'} /></Td>
                <Td className="text-xs text-muted-foreground">{fmtDate(r.published_at)}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(r); setOpen(true) }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => deleteRelease.mutate(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── Help Articles ─────────────────────────────────────────────────────────────

const articleSchema = z.object({
  id: z.string().optional(),
  category: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string(),
  is_published: z.boolean(),
})
type ArticleForm = z.infer<typeof articleSchema>

function ArticleDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: HelpArticle | null }) {
  const upsert = useUpsertHelpArticle()
  const { register, handleSubmit, reset } = useForm<ArticleForm>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      id: editing?.id,
      category: editing?.category ?? 'general',
      title: editing?.title ?? '',
      slug: editing?.slug ?? '',
      content: editing?.content ?? '',
      is_published: editing?.is_published ?? false,
    },
  })

  const onSubmit = async (data: ArticleForm) => {
    await upsert.mutateAsync(data)
    onClose(); reset()
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Editar artigo' : 'Novo artigo'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Categoria</label>
              <Input {...register('category')} className="mt-1" placeholder="Geral, Configuração..." />
            </div>
            <div>
              <label className="text-xs font-medium">Slug</label>
              <Input {...register('slug')} className="mt-1" placeholder="como-conectar-whatsapp" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Título</label>
            <Input {...register('title')} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">Conteúdo (Markdown)</label>
            <Textarea {...register('content')} rows={10} className="mt-1 font-mono text-xs" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register('is_published')} className="h-4 w-4" />
            Publicar
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SAHelpArticles() {
  const { data: articles = [], isLoading } = useHelpArticles()
  const deleteArticle = useDeleteHelpArticle()
  const [editing, setEditing] = useState<HelpArticle | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <Section title="Help Articles" action={
      <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>
        <Plus className="h-3.5 w-3.5" /> Novo artigo
      </Button>
    }>
      <ArticleDialog open={open} onClose={() => setOpen(false)} editing={editing} />
      {isLoading
        ? <Skeleton className="h-48 w-full" />
        : (
          <Table heads={['Título', 'Categoria', 'Slug', 'Visualizações', 'Status', 'Ações']}>
            {articles.map(a => (
              <Tr key={a.id}>
                <Td className="font-medium">{a.title}</Td>
                <Td><Badge variant="outline" className="text-[10px]">{a.category}</Badge></Td>
                <Td className="font-mono text-xs text-muted-foreground">{a.slug}</Td>
                <Td className="text-xs">{a.view_count}</Td>
                <Td><StatusBadge status={a.is_published ? 'active' : 'paused'} /></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(a); setOpen(true) }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => deleteArticle.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── Support Tickets ───────────────────────────────────────────────────────────

export function SASupport() {
  const [filter, setFilter] = useState('open')
  const { data: tickets = [], isLoading } = useSupportTickets(filter)
  const updateTicket = useUpdateTicket()

  const filters = ['all', 'open', 'in_progress', 'waiting', 'resolved', 'closed']

  return (
    <Section title="Suporte / Tickets">
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >{f}</button>
        ))}
      </div>

      {isLoading
        ? <Skeleton className="h-64 w-full" />
        : (
          <Table heads={['Assunto', 'Organização', 'Usuário', 'Prioridade', 'Status', 'Criado', 'Ação']}>
            {tickets.map(t => (
              <Tr key={t.id}>
                <Td className="font-medium max-w-xs truncate">{t.subject}</Td>
                <Td className="text-xs">{t.organizations?.name ?? '—'}</Td>
                <Td className="text-xs text-muted-foreground">{t.profiles?.email ?? '—'}</Td>
                <Td><StatusBadge status={t.priority} /></Td>
                <Td><StatusBadge status={t.status} /></Td>
                <Td className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</Td>
                <Td>
                  <select
                    className="text-xs border border-border rounded px-2 py-1 bg-card"
                    value={t.status}
                    onChange={e => updateTicket.mutate({ id: t.id, status: e.target.value as SupportTicket['status'] })}
                  >
                    {['open','in_progress','waiting','resolved','closed'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── Branding ──────────────────────────────────────────────────────────────────

export function SABranding() {
  const { data: settings = [] } = usePlatformSettings()
  const update = useUpdatePlatformSetting()
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  const brandingKeys = ['platform_name', 'logo_url', 'favicon_url', 'primary_color', 'platform_url']
  const brandingSettings = settings.filter(s => brandingKeys.includes(s.key))

  const getValue = (key: string) => editing[key] ?? settings.find(s => s.key === key)?.value ?? ''

  const save = async (key: string) => {
    await update.mutateAsync({ key, value: getValue(key) })
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  return (
    <Section title="Branding & White-label">
      <div className="grid grid-cols-1 gap-4 max-w-xl">
        {brandingSettings.map(s => (
          <div key={s.key} className="space-y-1.5">
            <label className="text-xs font-medium text-foreground capitalize">
              {s.description ?? s.key}
            </label>
            <div className="flex gap-2">
              {s.key === 'primary_color'
                ? <div className="flex gap-2 items-center flex-1">
                    <input type="color" value={getValue(s.key)} onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))} className="h-9 w-12 rounded border border-border cursor-pointer" />
                    <Input value={getValue(s.key)} onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))} className="flex-1 font-mono text-sm" />
                  </div>
                : <Input value={getValue(s.key)} onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))} className="flex-1" />
              }
              <Button variant="outline" size="sm" onClick={() => save(s.key)} disabled={update.isPending}>
                {saved === s.key ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Email Settings ─────────────────────────────────────────────────────────────

export function SAEmailSettings() {
  const { data: settings = [] } = usePlatformSettings()
  const update = useUpdatePlatformSetting()
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  const emailKeys = ['from_email', 'from_name', 'support_email', 'resend_api_key']
  const emailSettings = settings.filter(s => emailKeys.includes(s.key))

  const getValue = (key: string) => editing[key] ?? settings.find(s => s.key === key)?.value ?? ''
  const save = async (key: string) => {
    await update.mutateAsync({ key, value: getValue(key) })
    setSaved(key); setTimeout(() => setSaved(null), 2000)
  }

  return (
    <Section title="Email Settings">
      <Card className="max-w-xl">
        <CardContent className="pt-5 space-y-4">
          {emailSettings.map(s => (
            <div key={s.key} className="space-y-1.5">
              <label className="text-xs font-medium">{s.description ?? s.key}</label>
              <div className="flex gap-2">
                <Input
                  type={s.key.includes('key') ? 'password' : 'text'}
                  value={getValue(s.key)}
                  onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => save(s.key)}>
                  {saved === s.key ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </Section>
  )
}

// ── Platform Settings ─────────────────────────────────────────────────────────

export function SAPlatformSettings() {
  const { data: settings = [] } = usePlatformSettings()
  const update = useUpdatePlatformSetting()
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<string | null>(null)

  const skip = ['platform_name', 'logo_url', 'favicon_url', 'primary_color', 'platform_url', 'from_email', 'from_name', 'support_email', 'resend_api_key']
  const platformSettings = settings.filter(s => !skip.includes(s.key))

  const getValue = (key: string) => editing[key] ?? settings.find(s => s.key === key)?.value ?? ''
  const save = async (key: string) => {
    await update.mutateAsync({ key, value: getValue(key) })
    setSaved(key); setTimeout(() => setSaved(null), 2000)
  }

  return (
    <Section title="Configurações da Plataforma">
      <div className="max-w-2xl space-y-3">
        {platformSettings.map(s => (
          <div key={s.key} className="border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium font-mono">{s.key}</p>
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              </div>
              {s.is_secret && (
                <button onClick={() => setShow(p => ({ ...p, [s.key]: !p[s.key] }))}>
                  {show[s.key] ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type={s.is_secret && !show[s.key] ? 'password' : 'text'}
                value={getValue(s.key)}
                onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))}
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => save(s.key)}>
                {saved === s.key ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── AI Quality ────────────────────────────────────────────────────────────────

export function SAAIQuality() {
  const { data: execs = [], isLoading } = useAgentToolExecutions(200)

  const stats = execs.reduce<{ total: number; ok: number; error: number; avgMs: number }>(
    (acc, e) => {
      acc.total++
      if (e.status === 'success') acc.ok++
      else acc.error++
      acc.avgMs += e.duration_ms ?? 0
      return acc
    },
    { total: 0, ok: 0, error: 0, avgMs: 0 }
  )
  if (stats.total > 0) stats.avgMs = Math.round(stats.avgMs / stats.total)

  return (
    <Section title="AI Quality">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Execuções', value: stats.total, color: 'bg-blue-500' },
          { label: 'Sucesso', value: stats.ok, color: 'bg-emerald-500' },
          { label: 'Erro', value: stats.error, color: 'bg-red-500' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', k.color)}>
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="font-display text-xl font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading
        ? <Skeleton className="h-64 w-full" />
        : (
          <Table heads={['Ferramenta', 'Agente', 'Status', 'Duração', 'Quando']}>
            {execs.slice(0, 50).map(e => (
              <Tr key={e.id}>
                <Td className="font-mono text-xs font-medium">{e.tool_name}</Td>
                <Td className="text-xs">{e.ai_agents?.name ?? '—'}</Td>
                <Td><StatusBadge status={e.status === 'success' ? 'active' : 'cancelled'} /></Td>
                <Td className="text-xs">{e.duration_ms ? `${e.duration_ms}ms` : '—'}</Td>
                <Td className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── Tool Executions ───────────────────────────────────────────────────────────

export function SAToolExecutions() {
  const { data: execs = [], isLoading } = useAgentToolExecutions(200)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <Section title="Agent Tool Executions">
      {isLoading
        ? <Skeleton className="h-64 w-full" />
        : (
          <div className="space-y-1 rounded-xl border border-border overflow-hidden">
            {execs.slice(0, 100).map(e => (
              <div key={e.id}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                >
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', e.status === 'success' ? 'bg-emerald-500' : 'bg-red-500')} />
                  <span className="font-mono text-xs font-medium flex-1 truncate">{e.tool_name}</span>
                  <span className="text-xs text-muted-foreground">{e.ai_agents?.name}</span>
                  <span className="text-xs text-muted-foreground">{e.duration_ms ? `${e.duration_ms}ms` : ''}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded === e.id && 'rotate-180')} />
                </button>
                {expanded === e.id && (
                  <div className="px-4 pb-3 space-y-2 bg-muted/30">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Input</p>
                      <pre className="text-[10px] bg-card border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(e.input, null, 2)}
                      </pre>
                    </div>
                    {e.output && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Output</p>
                        <pre className="text-[10px] bg-card border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(e.output, null, 2)}
                        </pre>
                      </div>
                    )}
                    {e.error_message && (
                      <p className="text-xs text-destructive font-mono">{e.error_message}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </Section>
  )
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export function SAAuditLogs() {
  const { data: logs = [], isLoading } = useAuditLogs(200)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <Section title="Audit Logs">
      {isLoading
        ? <Skeleton className="h-64 w-full" />
        : (
          <Table heads={['Ação', 'Recurso', 'Usuário', 'Organização', 'Data']}>
            {logs.map(log => (
              <Tr key={log.id} onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                <Td className="font-mono text-xs font-medium">{log.action}</Td>
                <Td className="text-xs">
                  {log.resource_type ? <Badge variant="outline" className="text-[10px]">{log.resource_type}</Badge> : '—'}
                </Td>
                <Td className="text-xs">{log.profiles?.email ?? '—'}</Td>
                <Td className="text-xs">{log.organizations?.name ?? '—'}</Td>
                <Td className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</Td>
              </Tr>
            ))}
          </Table>
        )
      }
    </Section>
  )
}

// ── System Health ─────────────────────────────────────────────────────────────

export function SASystemHealth() {
  const { data: checks = [], isLoading, refetch } = useSystemHealth()
  const runChecks = useRunHealthChecks()

  const latest: Record<string, typeof checks[0]> = {}
  for (const c of checks) {
    if (!latest[c.service]) latest[c.service] = c
  }
  const latestChecks = Object.values(latest)

  const allOk = latestChecks.every(c => c.status === 'ok')

  return (
    <Section title="System Health" action={
      <Button
        size="sm" variant="outline"
        onClick={() => runChecks.mutate()}
        disabled={runChecks.isPending}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', runChecks.isPending && 'animate-spin')} />
        {runChecks.isPending ? 'Verificando...' : 'Verificar agora'}
      </Button>
    }>
      <div className={cn(
        'rounded-xl border px-4 py-3 flex items-center gap-3 text-sm font-medium',
        allOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
      )}>
        {allOk
          ? <><CheckCircle2 className="h-4 w-4" /> Todos os sistemas operacionais</>
          : <><XCircle className="h-4 w-4" /> Problema detectado em algum serviço</>
        }
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          : latestChecks.map(c => (
            <Card key={c.service}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn(
                  'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center',
                  c.status === 'ok' ? 'bg-emerald-100' : c.status === 'degraded' ? 'bg-amber-100' : 'bg-red-100'
                )}>
                  {c.status === 'ok'
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    : <XCircle className="h-5 w-5 text-red-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm font-mono">{c.service}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.latency_ms ? `${c.latency_ms}ms · ` : ''}{timeAgo(c.checked_at)}
                  </p>
                  {c.message && <p className="text-xs text-destructive mt-0.5">{c.message}</p>}
                </div>
                <StatusBadge status={c.status} />
              </CardContent>
            </Card>
          ))
        }
        {latestChecks.length === 0 && !isLoading && (
          <div className="col-span-2 text-center py-8 text-sm text-muted-foreground">
            Nenhuma verificação executada ainda. Clique em "Verificar agora".
          </div>
        )}
      </div>

      {checks.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de verificações</CardTitle></CardHeader>
          <CardContent>
            <Table heads={['Serviço', 'Status', 'Latência', 'Verificado']}>
              {checks.slice(0, 20).map(c => (
                <Tr key={c.id}>
                  <Td className="font-mono text-xs">{c.service}</Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td className="text-xs">{c.latency_ms ? `${c.latency_ms}ms` : '—'}</Td>
                  <Td className="text-xs text-muted-foreground">{timeAgo(c.checked_at)}</Td>
                </Tr>
              ))}
            </Table>
          </CardContent>
        </Card>
      )}
    </Section>
  )
}

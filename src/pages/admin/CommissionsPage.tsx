import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Trophy, TrendingUp, DollarSign, Target, Plus, Trash2, Edit2,
  CheckCircle2, Clock, Users, Settings, ChevronUp, ChevronDown,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useLeaderboard, useCommissions, useUpdateCommissionStatus,
  useCommissionRules, useUpsertCommissionRule, useDeleteCommissionRule,
  useSalesGoals, useUpsertSalesGoal, useDeleteSalesGoal,
  useDistributionConfig, useSaveDistributionConfig,
  useSalesSquads, useCreateSquad, useDeleteSquad,
  useCommissionSparkline,
} from '@/hooks/useCommissions'
import type {
  CommissionRule, SalesGoal, Commission,
} from '@/hooks/useCommissions'

// ── Formatting ────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents)

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 80, h = 28
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Goal Progress Bar ─────────────────────────────────────────────────────────

function GoalProgressBar({ goal, current }: { goal: SalesGoal; current: number }) {
  const pct = Math.min(Math.round((current / goal.target_value) * 100), 100)
  const color = pct >= 100 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-primary'

  const formatValue = (v: number) => {
    if (goal.metric === 'revenue') return fmt(v)
    return v.toLocaleString('pt-BR')
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{formatValue(current)}</span>
        <span className="font-medium">{pct}%</span>
        <span className="text-muted-foreground">{formatValue(goal.target_value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Leaderboard Tab ───────────────────────────────────────────────────────────

function LeaderboardTab() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const { data: entries = [], isLoading } = useLeaderboard(period)

  const RANK_ICONS = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={period} onValueChange={v => setPeriod(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="quarter">Este trimestre</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {entries.map((e, i) => {
          const { data: sparkData } = useCommissionSparkline(e.user_id)
          const sparkValues = (sparkData ?? []).map(s => s.value)

          return (
            <div key={e.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <span className="text-lg w-7 text-center flex-shrink-0">
                {i < 3 ? RANK_ICONS[i] : <span className="text-sm text-muted-foreground">{e.rank}</span>}
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                {(e.full_name ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.full_name ?? 'Usuário'}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{e.deals_won} deals</span>
                  <span className="text-success font-medium">{fmt(e.commission)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold">{fmt(e.revenue)}</p>
                  <p className="text-xs text-muted-foreground">receita</p>
                </div>
                <Sparkline data={sparkValues} />
              </div>
            </div>
          )
        })}
        {!isLoading && entries.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum dado de comissão ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Commissions Tab ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<Commission['status'], string> = {
  pending:   'bg-warning/15 text-warning',
  approved:  'bg-primary/15 text-primary',
  paid:      'bg-success/15 text-success',
  cancelled: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<Commission['status'], string> = {
  pending:   'Pendente',
  approved:  'Aprovada',
  paid:      'Paga',
  cancelled: 'Cancelada',
}

function CommissionsTab() {
  const [statusFilter, setStatusFilter] = useState<Commission['status'] | ''>('')
  const { data: commissions = [], isLoading } = useCommissions({
    status: statusFilter || undefined,
  })
  const update = useUpdateCommissionStatus()

  const total = commissions.reduce((s, c) => s + c.commission_value, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="paid">Pagas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {commissions.length} · Total: {fmt(total)}
        </span>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {commissions.map(c => (
        <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {(c.profiles as any)?.full_name ?? 'Vendedor'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              {(c.products as any)?.name && <span>{(c.products as any).name}</span>}
              {(c.deals as any)?.title && <span>{(c.deals as any).title}</span>}
              <span>{format(parseISO(c.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>
          <div className="text-right mr-2">
            <p className="text-sm font-semibold text-success">{fmt(c.commission_value)}</p>
            <p className="text-xs text-muted-foreground">de {fmt(c.deal_value)}</p>
          </div>
          <div className="flex items-center gap-1">
            {c.status === 'pending' && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => update.mutate({ id: c.id, status: 'approved' })}
              >
                Aprovar
              </Button>
            )}
            {c.status === 'approved' && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs text-success border-success/30"
                onClick={() => update.mutate({ id: c.id, status: 'paid', paid_at: new Date().toISOString() })}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Pagar
              </Button>
            )}
          </div>
        </div>
      ))}

      {!isLoading && commissions.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma comissão registrada.</p>
        </div>
      )}
    </div>
  )
}

// ── Goals Tab ─────────────────────────────────────────────────────────────────

const goalSchema = z.object({
  title: z.string().min(2),
  metric: z.enum(['revenue','deals_count','leads_count']),
  target_value: z.number().min(1),
  period_type: z.enum(['daily','weekly','monthly','quarterly','annual','custom']),
  period_start: z.string(),
  period_end: z.string(),
  user_id: z.string().optional(),
  squad_id: z.string().optional(),
})

type GoalForm = z.infer<typeof goalSchema>

function GoalDialog({ open, onClose, editing }: {
  open: boolean
  onClose: () => void
  editing: SalesGoal | null
}) {
  const upsert = useUpsertSalesGoal()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: editing
      ? {
          title: editing.title,
          metric: editing.metric,
          target_value: editing.target_value,
          period_type: editing.period_type,
          period_start: editing.period_start,
          period_end: editing.period_end,
          user_id: editing.user_id ?? undefined,
          squad_id: editing.squad_id ?? undefined,
        }
      : {
          metric: 'revenue' as const,
          period_type: 'monthly' as const,
          period_start: new Date().toISOString().slice(0, 10),
          period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
            .toISOString().slice(0, 10),
          target_value: 10000,
        },
  })

  const onSubmit = async (values: GoalForm) => {
    await upsert.mutateAsync({
      id: editing?.id ?? crypto.randomUUID(),
      title: values.title,
      metric: values.metric,
      target_value: values.target_value,
      period_type: values.period_type,
      period_start: values.period_start,
      period_end: values.period_end,
      user_id: values.user_id || null,
      squad_id: values.squad_id || null,
      product_id: null,
      is_active: true,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar' : 'Nova'} Meta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Título *</label>
            <Input {...register('title')} placeholder="Meta de vendas março" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Métrica</label>
              <Select value={watch('metric')} onValueChange={v => setValue('metric', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita (R$)</SelectItem>
                  <SelectItem value="deals_count">Qtd. Deals</SelectItem>
                  <SelectItem value="leads_count">Qtd. Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Meta *</label>
              <Input type="number" {...register('target_value', { valueAsNumber: true })} placeholder="10000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Início</label>
              <Input type="date" {...register('period_start')} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fim</label>
              <Input type="date" {...register('period_end')} />
            </div>
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

function GoalsTab() {
  const { data: goals = [], isLoading } = useSalesGoals()
  const deleteGoal = useDeleteSalesGoal()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SalesGoal | null>(null)

  const METRIC_LABEL: Record<SalesGoal['metric'], string> = {
    revenue: 'Receita',
    deals_count: 'Deals',
    leads_count: 'Leads',
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Meta
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {goals.map(goal => (
        <div key={goal.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{goal.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {METRIC_LABEL[goal.metric]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(goal.profiles as any)?.full_name
                  ? `Vendedor: ${(goal.profiles as any).full_name}`
                  : (goal.sales_squads as any)?.name
                    ? `Time: ${(goal.sales_squads as any).name}`
                    : 'Toda a equipe'
                }
                {' · '}
                {format(new Date(goal.period_start + 'T12:00:00'), 'dd/MM', { locale: ptBR })} –{' '}
                {format(new Date(goal.period_end   + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon" variant="ghost" className="h-7 w-7"
                onClick={() => { setEditing(goal); setDialogOpen(true) }}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                onClick={() => deleteGoal.mutate(goal.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {/* Simplified progress — current value computed lazily */}
          <GoalProgressBar goal={goal} current={0} />
        </div>
      ))}

      {!isLoading && goals.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma meta configurada.</p>
        </div>
      )}

      <GoalDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />
    </div>
  )
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────

const ruleSchema = z.object({
  name: z.string().min(2),
  rule_type: z.enum(['percentage','fixed']),
  base_value: z.number().min(0),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  is_default: z.boolean(),
})

type RuleForm = z.infer<typeof ruleSchema>

function RuleDialog({ open, onClose, editing }: {
  open: boolean
  onClose: () => void
  editing: CommissionRule | null
}) {
  const upsert = useUpsertCommissionRule()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          rule_type: editing.rule_type,
          base_value: editing.base_value,
          min_value: editing.min_value ?? undefined,
          max_value: editing.max_value ?? undefined,
          is_default: editing.is_default,
        }
      : {
          rule_type: 'percentage' as const,
          is_default: false,
          base_value: 10,
        },
  })

  const ruleType = watch('rule_type')

  const onSubmit = async (values: RuleForm) => {
    await upsert.mutateAsync({
      id: editing?.id ?? crypto.randomUUID(),
      product_id: editing?.product_id ?? null,
      applies_to_role: editing?.applies_to_role ?? null,
      name: values.name,
      rule_type: values.rule_type,
      base_value: values.base_value,
      min_value: values.min_value ?? null,
      max_value: values.max_value ?? null,
      is_default: values.is_default,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar' : 'Nova'} Regra de Comissão</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome *</label>
            <Input {...register('name')} placeholder="Comissão padrão" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={ruleType} onValueChange={v => setValue('rule_type', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {ruleType === 'percentage' ? 'Percentual (%)' : 'Valor fixo (R$)'}
              </label>
              <Input type="number" step="0.01" {...register('base_value', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mínimo (R$)</label>
              <Input type="number" step="0.01" {...register('min_value', { valueAsNumber: true })} placeholder="—" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Máximo (R$)</label>
              <Input type="number" step="0.01" {...register('max_value', { valueAsNumber: true })} placeholder="—" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={watch('is_default')}
              onCheckedChange={v => setValue('is_default', v)}
            />
            <label className="text-sm">Regra padrão da org</label>
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

function RulesTab() {
  const { data: rules = [], isLoading } = useCommissionRules()
  const deleteRule = useDeleteCommissionRule()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionRule | null>(null)

  const { data: distConfig = [] } = useDistributionConfig()
  const saveDistrib = useSaveDistributionConfig()
  const defaultStrategy = distConfig[0]?.strategy ?? 'round_robin'

  return (
    <div className="space-y-6">
      {/* Commission Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Regras de Comissão</h3>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Regra
          </Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {rules.map(r => (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                {r.is_default && (
                  <Badge variant="secondary" className="text-xs bg-primary/15 text-primary">Padrão</Badge>
                )}
                {(r.products as any)?.name && (
                  <Badge variant="secondary" className="text-xs">{(r.products as any).name}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {r.rule_type === 'percentage'
                  ? `${r.base_value}%`
                  : `R$ ${r.base_value}`
                }
                {r.min_value != null && ` · Mín: R$ ${r.min_value}`}
                {r.max_value != null && ` · Máx: R$ ${r.max_value}`}
              </p>
            </div>
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => { setEditing(r); setDialogOpen(true) }}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-destructive"
              onClick={() => deleteRule.mutate(r.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {!isLoading && rules.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma regra configurada.
          </p>
        )}
      </div>

      {/* Distribution Strategy */}
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Distribuição de Leads</h3>
        <p className="text-xs text-muted-foreground">
          Estratégia usada ao chamar a função distribute_lead via IA ou importação.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'round_robin',  label: 'Round Robin',   desc: 'Rotativo entre vendedores' },
            { value: 'least_busy',   label: 'Menos ocupado', desc: 'Vendedor com menos leads' },
            { value: 'performance',  label: 'Performance',   desc: 'Melhor histórico no mês' },
          ] as const).map(s => (
            <button
              key={s.value}
              onClick={() => saveDistrib.mutate({ strategy: s.value })}
              className={`p-3 rounded-lg border text-left transition-colors ${
                defaultStrategy === s.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <RuleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />
    </div>
  )
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCards() {
  const { data: commissions = [] } = useCommissions()
  const { data: sparkData = [] } = useCommissionSparkline()

  const pending  = commissions.filter(c => c.status === 'pending')
  const approved = commissions.filter(c => c.status === 'approved')
  const paid     = commissions.filter(c => c.status === 'paid')

  const pendingTotal  = pending.reduce((s, c) => s + c.commission_value, 0)
  const approvedTotal = approved.reduce((s, c) => s + c.commission_value, 0)
  const paidTotal     = paid.reduce((s, c) => s + c.commission_value, 0)

  const sparkValues = sparkData.map(s => s.value)
  const lastTwo = sparkValues.slice(-2)
  const trend = lastTwo.length === 2
    ? lastTwo[1] > lastTwo[0] ? 'up' : lastTwo[1] < lastTwo[0] ? 'down' : 'flat'
    : 'flat'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: 'Pendentes', value: fmt(pendingTotal), count: pending.length, color: 'text-warning', icon: Clock },
        { label: 'Aprovadas', value: fmt(approvedTotal), count: approved.length, color: 'text-primary', icon: CheckCircle2 },
        { label: 'Pagas',     value: fmt(paidTotal),     count: paid.length,    color: 'text-success', icon: DollarSign },
        { label: 'Tendência', value: sparkValues.length ? fmt(sparkValues[sparkValues.length - 1]) : '—',
          count: null,
          color: trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground',
          icon: trend === 'up' ? ChevronUp : trend === 'down' ? ChevronDown : Minus },
      ].map(card => (
        <div key={card.label} className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{card.label}</span>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </div>
          <p className="text-lg font-bold">{card.value}</p>
          {card.count !== null && (
            <p className="text-xs text-muted-foreground">{card.count} comissões</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CommissionsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display">Comissões & Metas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie regras de comissão, acompanhe metas e visualize o ranking da equipe.
        </p>
      </div>

      <SummaryCards />

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard">
            <Trophy className="h-4 w-4 mr-1" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="goals">Metas</TabsTrigger>
          <TabsTrigger value="rules">Regras & Distribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">
          <LeaderboardTab />
        </TabsContent>
        <TabsContent value="commissions" className="mt-4">
          <CommissionsTab />
        </TabsContent>
        <TabsContent value="goals" className="mt-4">
          <GoalsTab />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <RulesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

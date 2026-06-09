import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Target, TrendingUp, DollarSign, Clock, Zap, AlertTriangle,
  ChevronRight, ArrowRight, Users, BarChart3, Activity,
  CheckCircle2, XCircle, RefreshCw, Flame, ShieldCheck,
  CalendarClock, CircleDot, ChevronDown, ChevronUp, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  usePipelineData, usePipelineProducts, useStageMovements,
  type PipelineStage, type PipelineDeal, type PipelineLead,
} from '@/hooks/usePipeline'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return format(parseISO(iso), 'dd/MM', { locale: ptBR })
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function healthColor(score: number) {
  if (score >= 80) return 'text-emerald-500'
  if (score >= 60) return 'text-amber-500'
  return 'text-red-500'
}

function probColor(p: number) {
  if (p >= 70) return 'bg-emerald-500'
  if (p >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

// ── Visual Funnel SVG ─────────────────────────────────────────────────────────

function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const visible = stages.filter(s => !s.is_lost)
  if (!visible.length) return null
  const maxLeads = Math.max(...visible.map(s => s.leadCount), 1)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-end gap-0 min-w-max mx-auto" style={{ minWidth: visible.length * 120 }}>
        {visible.map((stage, i) => {
          const pct = stage.leadCount / maxLeads
          const barH = Math.max(pct * 120, stage.leadCount > 0 ? 24 : 8)
          const isLast = i === visible.length - 1

          return (
            <div key={stage.id} className="flex items-end gap-0">
              {/* Stage bar */}
              <div className="flex flex-col items-center group cursor-default" style={{ width: 100 }}>
                {/* Value label above */}
                <div className="mb-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] font-bold text-foreground">{fmtBRL(stage.totalValue)}</p>
                  <p className="text-[9px] text-muted-foreground">{stage.weightedValue > 0 ? `prev. ${fmtBRL(stage.weightedValue)}` : ''}</p>
                </div>

                {/* Bar */}
                <div
                  className="relative w-full rounded-t-xl transition-all duration-500 flex flex-col items-center justify-end pb-2 hover:brightness-110"
                  style={{
                    height: barH + 16,
                    backgroundColor: hexToRgba(stage.color.startsWith('#') ? stage.color : '#6366f1', 0.85),
                    minHeight: 32,
                  }}
                >
                  <span className="text-white text-sm font-bold leading-none">{stage.leadCount}</span>
                  <span className="text-white/70 text-[9px]">leads</span>

                  {/* Probability pill */}
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow"
                    style={{ backgroundColor: stage.color.startsWith('#') ? stage.color : '#6366f1' }}
                  >
                    {stage.probability}%
                  </div>
                </div>

                {/* Stage label */}
                <div className="mt-2 text-center px-1">
                  <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-2">{stage.name}</p>
                  {stage.avgDaysInStage > 0 && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">~{stage.avgDaysInStage}d</p>
                  )}
                </div>

                {/* Conversion badge */}
                {stage.conversionFromPrev !== null && (
                  <div className={cn(
                    'mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    stage.conversionFromPrev >= 50 ? 'bg-emerald-500/15 text-emerald-600' :
                    stage.conversionFromPrev >= 25 ? 'bg-amber-500/15 text-amber-600' :
                    'bg-red-500/15 text-red-600'
                  )}>
                    {stage.conversionFromPrev}% conv.
                  </div>
                )}
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <div className="flex items-center pb-6 px-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Health Score Gauge ────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const r = 40; const cx = 50; const cy = 50
  const circumference = Math.PI * r
  const dashOffset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 100 60" className="w-full max-w-[120px]">
      {/* Track */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" strokeLinecap="round" />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="50" y="48" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{score}</text>
    </svg>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, pulse = false }: {
  label: string; value: React.ReactNode; sub?: string
  icon: React.ElementType; color: string; pulse?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
        <Icon className="h-4.5 w-4.5" />
        {pulse && <span className="absolute h-2 w-2 rounded-full bg-emerald-500 animate-ping" />}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Deal Card ─────────────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: PipelineDeal }) {
  const isOverdue = deal.expected_close && new Date(deal.expected_close) < new Date() && deal.status === 'open'
  const isStale   = deal.daysOpen > 30 && deal.status === 'open'

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 flex gap-3 hover:shadow-md transition-shadow',
      isOverdue ? 'border-red-500/30' : isStale ? 'border-amber-500/30' : 'border-border'
    )}>
      {/* Prob bar */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="w-2 rounded-full bg-muted overflow-hidden" style={{ height: 60 }}>
          <div
            className={cn('w-full rounded-full transition-all', probColor(deal.probability))}
            style={{ height: `${deal.probability}%`, marginTop: `${100 - deal.probability}%` }}
          />
        </div>
        <span className="text-[9px] text-muted-foreground tabular-nums">{deal.probability}%</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
          <span className="text-sm font-bold text-foreground flex-shrink-0 tabular-nums">{fmtBRL(deal.value)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{deal.leadName}</p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: deal.stageColor.startsWith('#') ? deal.stageColor : '#6366f1' }}
          >
            {deal.stageName}
          </span>

          {deal.expected_close && (
            <span className={cn('flex items-center gap-1 text-[10px]', isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
              <CalendarClock className="h-3 w-3" />
              {format(parseISO(deal.expected_close), 'dd/MM', { locale: ptBR })}
            </span>
          )}

          {isStale && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
              <Flame className="h-3 w-3" />
              {deal.daysOpen}d parado
            </span>
          )}

          {deal.ownerName && (
            <span className="text-[10px] text-muted-foreground ml-auto">{deal.ownerName}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Lead Row ──────────────────────────────────────────────────────────────────

function LeadRow({ lead }: { lead: PipelineLead }) {
  return (
    <tr className="border-b border-border/50 hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="text-[10px]">{lead.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground leading-none">{lead.name}</p>
            {lead.company && <p className="text-[10px] text-muted-foreground mt-0.5">{lead.company}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: lead.stageColor.startsWith('#') ? lead.stageColor : '#6366f1' }}
        >
          {lead.stageName}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm font-medium text-foreground">
        {lead.dealValue > 0 ? fmtBRL(lead.dealValue) : <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-center">
          <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${lead.stageProbability}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-7">{lead.stageProbability}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-flex items-center gap-1 text-[10px] font-medium tabular-nums',
          lead.daysInStage > 14 ? 'text-amber-500' : lead.daysInStage > 30 ? 'text-red-500' : 'text-muted-foreground'
        )}>
          {lead.daysInStage > 14 && <Flame className="h-3 w-3" />}
          {lead.daysInStage}d
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          <div className="h-1.5 w-10 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full', lead.lead_score >= 70 ? 'bg-emerald-500' : lead.lead_score >= 40 ? 'bg-amber-500' : 'bg-muted-foreground/50')} style={{ width: `${lead.lead_score}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-5 text-right">{lead.lead_score}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-[10px] text-muted-foreground">
        {lead.assignedName ?? '—'}
      </td>
    </tr>
  )
}

// ── Stage Breakdown Table ─────────────────────────────────────────────────────

function StageBreakdown({ stages }: { stages: PipelineStage[] }) {
  const visible = stages.filter(s => !s.is_lost)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Breakdown por Etapa</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Etapa</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Leads</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Negócios</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Valor total</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ponderado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Prob.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Média dias</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Conv.</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(s => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color.startsWith('#') ? s.color : '#6366f1' }} />
                    <span className="font-medium text-foreground text-sm">{s.name}</span>
                    {s.is_won && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{s.leadCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{s.dealCount}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{s.totalValue > 0 ? fmtBRL(s.totalValue) : '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-primary font-medium">{s.weightedValue > 0 ? fmtBRL(s.weightedValue) : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('text-xs font-bold', s.probability >= 70 ? 'text-emerald-500' : s.probability >= 40 ? 'text-amber-500' : 'text-muted-foreground')}>
                    {s.probability}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('text-xs tabular-nums', s.avgDaysInStage > 14 ? 'text-amber-500 font-medium' : 'text-muted-foreground')}>
                    {s.avgDaysInStage > 0 ? `${s.avgDaysInStage}d` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {s.conversionFromPrev !== null ? (
                    <span className={cn('text-xs font-bold', s.conversionFromPrev >= 50 ? 'text-emerald-500' : s.conversionFromPrev >= 25 ? 'text-amber-500' : 'text-red-500')}>
                      {s.conversionFromPrev}%
                    </span>
                  ) : <span className="text-muted-foreground/30">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed() {
  const { data: movements, isLoading } = useStageMovements(12)

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Movimentações Recentes</p>
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {isLoading
          ? [1,2,3,4].map(i => <div key={i} className="h-12 m-3 animate-pulse rounded-lg bg-muted" />)
          : !movements?.length
            ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            : movements.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <CircleDot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{m.leadName}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {m.fromStage && (
                        <>
                          <span className="text-[10px] text-muted-foreground">{m.fromStage}</span>
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 flex-shrink-0" />
                        </>
                      )}
                      <span className="text-[10px] font-medium text-primary">{m.toStage ?? '—'}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                    {m.changedBy && <p className="text-[9px] text-muted-foreground/60 truncate max-w-[80px]">{m.changedBy}</p>}
                  </div>
                </div>
              ))
        }
      </div>
    </div>
  )
}

// ── Health Panel ──────────────────────────────────────────────────────────────

function HealthPanel({ stages, kpis }: { stages: PipelineStage[]; kpis: any }) {
  const alerts = useMemo(() => {
    const list: { type: 'warn' | 'ok' | 'err'; text: string }[] = []

    const emptyStages = stages.filter(s => !s.is_won && !s.is_lost && s.leadCount === 0)
    if (emptyStages.length)
      list.push({ type: 'warn', text: `${emptyStages.length} etapa${emptyStages.length > 1 ? 's' : ''} sem leads (${emptyStages.map(s => s.name).join(', ')})` })

    const bottleneckStage = stages.filter(s => !s.is_won && !s.is_lost).sort((a, b) => b.avgDaysInStage - a.avgDaysInStage)[0]
    if (bottleneckStage?.avgDaysInStage > 14)
      list.push({ type: 'warn', text: `Gargalo: "${bottleneckStage.name}" com média ${bottleneckStage.avgDaysInStage}d por lead` })

    if (kpis.staleDeals > 0)
      list.push({ type: 'err', text: `${kpis.staleDeals} negócio${kpis.staleDeals > 1 ? 's' : ''} parado${kpis.staleDeals > 1 ? 's' : ''} há mais de 30 dias` })

    if (kpis.totalDeals > 0 && (kpis.weightedForecast / kpis.totalPipelineValue) < 0.3)
      list.push({ type: 'warn', text: 'Probabilidade média baixa no pipeline — revise os estágios dos negócios' })

    if (list.length === 0)
      list.push({ type: 'ok', text: 'Pipeline saudável! Nenhuma anomalia detectada.' })

    return list
  }, [stages, kpis])

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Saúde do Pipeline</p>
        </div>
        <span className={cn('text-2xl font-bold tabular-nums', healthColor(kpis.healthScore))}>
          {kpis.healthScore}/100
        </span>
      </div>
      <div className="p-4">
        <div className="flex justify-center mb-4">
          <HealthGauge score={kpis.healthScore} />
        </div>
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.type === 'ok' ? CheckCircle2 : a.type === 'err' ? XCircle : AlertTriangle
            const cls  = a.type === 'ok' ? 'text-emerald-500' : a.type === 'err' ? 'text-red-500' : 'text-amber-500'
            return (
              <div key={i} className="flex items-start gap-2">
                <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', cls)} />
                <p className="text-xs text-muted-foreground leading-relaxed">{a.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Product Filter ────────────────────────────────────────────────────────────

function ProductFilter({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { data: products } = usePipelineProducts()

  if (!products?.length) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onChange(null)}
        className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', value === null ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
      >
        Todos
      </button>
      {products.map(p => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', value === p.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type DealView = 'open' | 'won' | 'lost'

export function PipelinePage() {
  const [productId, setProductId] = useState<string | null>(null)
  const [dealView,  setDealView]  = useState<DealView>('open')
  const [leadsExpanded, setLeadsExpanded] = useState(false)

  const { data, isLoading, refetch } = usePipelineData(productId)

  const { stages = [], deals = [], leads = [], kpis = {
    totalPipelineValue: 0, weightedForecast: 0, avgDealSize: 0,
    avgDaysToClose: 0, totalDeals: 0, totalLeads: 0,
    wonThisMonth: 0, wonValueThisMonth: 0, healthScore: 0, staleDeals: 0,
  } } = data ?? {}

  const filteredDeals = deals.filter(d =>
    dealView === 'open' ? d.status === 'open' :
    dealView === 'won'  ? d.status === 'won'  : d.status === 'lost'
  )

  const displayedLeads = leadsExpanded ? leads : leads.slice(0, 8)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20">
              <Target className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">Pipeline de Vendas</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-11">
            Forecast ponderado, velocidade e saúde dos negócios em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Product Filter ── */}
      <ProductFilter value={productId} onChange={setProductId} />

      {/* ── KPIs ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Pipeline total" value={fmtBRL(kpis.totalPipelineValue)} sub={`${kpis.totalDeals} negócios abertos`} icon={DollarSign} color="bg-violet-500/10 text-violet-500" />
          <KpiCard label="Forecast ponderado" value={fmtBRL(kpis.weightedForecast)} sub="Valor × probabilidade" icon={TrendingUp} color="bg-emerald-500/10 text-emerald-500" />
          <KpiCard label="Ticket médio" value={fmtBRL(kpis.avgDealSize)} sub={`${kpis.wonThisMonth} fechados este mês`} icon={Target} color="bg-amber-500/10 text-amber-500" />
          <KpiCard label="Velocidade média" value={kpis.avgDaysToClose > 0 ? `${kpis.avgDaysToClose}d` : '—'} sub="Dias até fechar negócio" icon={Clock} color="bg-blue-500/10 text-blue-500" />
        </div>
      )}

      {/* ── Funnel visual ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Funil de Conversão</p>
              <p className="text-xs text-muted-foreground">Leads por etapa · taxa de avanço entre estágios</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary/40" /> Prob. %
          </div>
        </div>
        {isLoading
          ? <div className="h-40 animate-pulse rounded-xl bg-muted" />
          : <PipelineFunnel stages={stages} />
        }
      </div>

      {/* ── Stage breakdown + Health + Activity ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading
            ? <div className="h-56 animate-pulse rounded-2xl bg-muted" />
            : <StageBreakdown stages={stages} />
          }
        </div>
        <div className="space-y-4">
          {isLoading
            ? <div className="h-56 animate-pulse rounded-2xl bg-muted" />
            : <HealthPanel stages={stages} kpis={kpis} />
          }
        </div>
      </div>

      {/* ── Deals grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Negócios</p>
          </div>
          <div className="flex gap-1.5">
            {(['open', 'won', 'lost'] as DealView[]).map(v => {
              const labels = { open: `Abertos (${deals.filter(d => d.status === 'open').length})`, won: `Ganhos (${deals.filter(d => d.status === 'won').length})`, lost: `Perdidos (${deals.filter(d => d.status === 'lost').length})` }
              return (
                <button
                  key={v}
                  onClick={() => setDealView(v)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                    dealView === v ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {labels[v]}
                </button>
              )
            })}
          </div>
        </div>

        {isLoading
          ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>
          : !filteredDeals.length
            ? <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">Nenhum negócio {dealView === 'open' ? 'aberto' : dealView === 'won' ? 'ganho' : 'perdido'} encontrado.</div>
            : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDeals.slice(0, 12).map(d => <DealCard key={d.id} deal={d} />)}
              </div>
            )
        }
      </div>

      {/* ── Leads table + Activity ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Leads no Pipeline
                <span className="ml-2 text-xs font-normal text-muted-foreground">({leads.length})</span>
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Lead</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Etapa</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Prob.</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Tempo etapa</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Score</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [1,2,3].map(i => (
                      <tr key={i} className="border-b border-border/50">
                        <td colSpan={7} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td>
                      </tr>
                    ))
                  : displayedLeads.map(l => <LeadRow key={l.id} lead={l} />)
                }
              </tbody>
            </table>
          </div>
          {leads.length > 8 && (
            <button
              onClick={() => setLeadsExpanded(v => !v)}
              className="w-full py-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border"
            >
              {leadsExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Mostrar menos</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver todos ({leads.length})</>}
            </button>
          )}
          {!isLoading && !leads.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lead ativo no pipeline.</p>
          )}
        </div>

        <ActivityFeed />
      </div>
    </div>
  )
}

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart3, TrendingUp, TrendingDown, Users, MessageSquare,
  Bot, AlertTriangle, CheckCircle2, XCircle, Clock, Zap,
  DollarSign, Target, Activity, RefreshCw, Info, Minus,
  ChevronRight, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  usePlatformOverview,
  useLeadsTimeSeries,
  useConversationsTimeSeries,
  useAIActivityTimeSeries,
  useLeadsBySource,
  useLeadsByStage,
  useUserActivity,
  useConversationsDetail,
  useAIAgentsStats,
  useSystemLogs,
  useReportLeads,
  type TimeSeriesPoint,
  type SystemLog,
} from '@/hooks/useReports'

// ── Chart primitives (SVG, no lib needed) ────────────────────────────────────

function Sparkline({ data, color = '#6366f1', height = 48, fill = false }: {
  data: TimeSeriesPoint[]; color?: string; height?: number; fill?: boolean
}) {
  if (!data.length) return <div style={{ height }} className="w-full" />
  const counts = data.map(d => d.count)
  const max = Math.max(...counts, 1)
  const w = 100; const h = height
  const pts = counts.map((v, i) => {
    const x = (i / (counts.length - 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return `${x},${y}`
  })
  const polyline = pts.join(' ')
  const fillPath = `M${pts[0]} ${pts.slice(1).map(p => `L${p}`).join(' ')} L${w},${h} L0,${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {fill && (
        <path d={fillPath} fill={color} fillOpacity="0.12" />
      )}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BarChartSVG({ data, color = '#6366f1', height = 120 }: {
  data: { label: string; value: number }[]; color?: string; height?: number
}) {
  if (!data.length) return <div style={{ height }} />
  const max = Math.max(...data.map(d => d.value), 1)
  const barW = 90 / data.length
  const gap = 10 / data.length

  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ height }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const barH = (d.value / max) * 90
        const x = i * (barW + gap)
        const y = 100 - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW * 0.75} height={barH} fill={color} opacity="0.85" rx="1.5" />
          </g>
        )
      })}
    </svg>
  )
}

function MiniDonut({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1
  let cumAngle = -90
  const r = 35; const cx = 50; const cy = 50; const stroke = 14

  return (
    <svg viewBox="0 0 100 100" className="w-full max-w-[120px]">
      {segments.map((seg, i) => {
        const angle = (seg.value / total) * 360
        const startAngle = cumAngle
        const endAngle = startAngle + angle - 1
        cumAngle += angle

        const toRad = (a: number) => (a * Math.PI) / 180
        const x1 = cx + r * Math.cos(toRad(startAngle))
        const y1 = cy + r * Math.sin(toRad(startAngle))
        const x2 = cx + r * Math.cos(toRad(endAngle))
        const y2 = cy + r * Math.sin(toRad(endAngle))
        const large = angle > 180 ? 1 : 0

        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )
      })}
      <text x="50" y="54" textAnchor="middle" fontSize="12" fill="currentColor" className="fill-foreground font-semibold">
        {total}
      </text>
    </svg>
  )
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card shadow-sm', className)}>
      {children}
    </div>
  )
}

function SectionTitle({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary" /></div>}
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}

function LoadingRow() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map(i => <div key={i} className="h-8 rounded-lg bg-muted" />)}
    </div>
  )
}

function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> 0%</span>
  const up = value > 0
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-500' : 'text-red-500')}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  )
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return format(parseISO(iso), "dd MMM", { locale: ptBR })
}

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: '#22c55e', instagram: '#e879f9', facebook: '#3b82f6',
  google: '#f59e0b', indicacao: '#06b6d4', site: '#8b5cf6',
  direct: '#94a3b8', organico: '#10b981',
}

const STATUS_COLORS: Record<string, string> = {
  open: '#22c55e', closed: '#94a3b8', in_progress: '#f59e0b',
  pending: '#6366f1', resolved: '#10b981',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta', closed: 'Fechada', in_progress: 'Em atendimento',
  pending: 'Pendente', resolved: 'Resolvida',
}

const LOG_ICONS: Record<SystemLog['type'], React.ElementType> = {
  error: XCircle, warning: AlertTriangle, info: Info,
}

const LOG_COLORS: Record<SystemLog['type'], string> = {
  error: 'text-red-500', warning: 'text-amber-500', info: 'text-blue-400',
}

// ── Tab: Visão Geral ──────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: overview, isLoading: ovLoading, refetch: refetchOv } = usePlatformOverview()
  const { data: leadSeries, isLoading: lsLoading } = useLeadsTimeSeries()
  const { data: convSeries, isLoading: csLoading } = useConversationsTimeSeries()
  const { data: aiSeries, isLoading: asLoading } = useAIActivityTimeSeries()

  const kpis = [
    {
      label: 'Leads este mês',
      value: overview?.leadsThisMonth ?? 0,
      sub: `${overview?.leadsTotal ?? 0} total`,
      growth: overview?.leadsGrowth ?? 0,
      icon: Target,
      color: 'bg-violet-500/10 text-violet-500',
      series: leadSeries,
      seriesColor: '#8b5cf6',
    },
    {
      label: 'Conversas abertas',
      value: overview?.conversationsOpen ?? 0,
      sub: `${overview?.conversationsThisMonth ?? 0} este mês`,
      growth: 0,
      icon: MessageSquare,
      color: 'bg-emerald-500/10 text-emerald-500',
      series: convSeries,
      seriesColor: '#22c55e',
    },
    {
      label: 'Receita este mês',
      value: fmtCurrency(overview?.revenueThisMonth ?? 0),
      sub: 'vs. mês anterior',
      growth: overview?.revenueGrowth ?? 0,
      icon: DollarSign,
      color: 'bg-amber-500/10 text-amber-500',
      series: null,
      seriesColor: '#f59e0b',
    },
    {
      label: 'Ações IA este mês',
      value: overview?.aiMessagesThisMonth ?? 0,
      sub: `${overview?.aiAgentsActive ?? 0} agentes ativos`,
      growth: 0,
      icon: Bot,
      color: 'bg-blue-500/10 text-blue-500',
      series: aiSeries,
      seriesColor: '#3b82f6',
    },
    {
      label: 'Usuários',
      value: overview?.activeUsers ?? 0,
      sub: 'na organização',
      growth: 0,
      icon: Users,
      color: 'bg-pink-500/10 text-pink-500',
      series: null,
      seriesColor: '#ec4899',
    },
    {
      label: 'Erros nas últimas 24h',
      value: overview?.errorsLast24h ?? 0,
      sub: 'falhas de agentes IA',
      growth: 0,
      icon: AlertTriangle,
      color: (overview?.errorsLast24h ?? 0) > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500',
      series: null,
      seriesColor: '#ef4444',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', kpi.color)}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <GrowthBadge value={kpi.growth} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">
                {ovLoading ? <span className="inline-block h-6 w-16 rounded bg-muted animate-pulse" /> : kpi.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{kpi.sub}</p>
            </div>
            {kpi.series && (
              <div className="mt-auto pt-1">
                <Sparkline data={kpi.series} color={kpi.seriesColor} height={32} fill />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Leads chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Leads — 30 dias</p>
              <p className="text-xs text-muted-foreground">Novos leads por dia</p>
            </div>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          {lsLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : (
            <Sparkline data={leadSeries ?? []} color="#8b5cf6" height={72} fill />
          )}
          {leadSeries && (
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{format(parseISO(leadSeries[0]?.date || new Date().toISOString()), 'dd/MM')}</span>
              <span>{format(parseISO(leadSeries[leadSeries.length - 1]?.date || new Date().toISOString()), 'dd/MM')}</span>
            </div>
          )}
        </Card>

        {/* Conversations chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Conversas — 30 dias</p>
              <p className="text-xs text-muted-foreground">Novas conversas por dia</p>
            </div>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </div>
          {csLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : (
            <Sparkline data={convSeries ?? []} color="#22c55e" height={72} fill />
          )}
          {convSeries && (
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{format(parseISO(convSeries[0]?.date || new Date().toISOString()), 'dd/MM')}</span>
              <span>{format(parseISO(convSeries[convSeries.length - 1]?.date || new Date().toISOString()), 'dd/MM')}</span>
            </div>
          )}
        </Card>

        {/* AI chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Ações IA — 30 dias</p>
              <p className="text-xs text-muted-foreground">Execuções de agentes por dia</p>
            </div>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </div>
          {asLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : (
            <Sparkline data={aiSeries ?? []} color="#3b82f6" height={72} fill />
          )}
          {aiSeries && (
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{format(parseISO(aiSeries[0]?.date || new Date().toISOString()), 'dd/MM')}</span>
              <span>{format(parseISO(aiSeries[aiSeries.length - 1]?.date || new Date().toISOString()), 'dd/MM')}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={() => refetchOv()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar dados
        </button>
      </div>
    </div>
  )
}

// ── Tab: Usuários ─────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users, isLoading } = useUserActivity()

  return (
    <div className="space-y-4">
      <SectionTitle title="Movimentação de Usuários" subtitle="Performance este mês" icon={Users} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Leads</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Conversas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Negócios ganhos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Receita</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={6} className="px-4 py-3"><div className="h-6 w-full animate-pulse rounded bg-muted" /></td>
                    </tr>
                  ))
                : (users ?? []).map((u, i) => {
                    const score = Math.min(100, (u.dealsWon * 20) + (u.leadsAssigned * 2) + (u.conversationsHandled))
                    return (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {i < 3 && (
                              <span className={cn('text-base leading-none', ['🥇','🥈','🥉'][i])}>{['🥇','🥈','🥉'][i]}</span>
                            )}
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={u.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground truncate max-w-[140px]">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{u.leadsAssigned}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{u.conversationsHandled}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-500 font-medium">{u.dealsWon}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{fmtCurrency(u.revenue)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{score}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
          {!isLoading && !users?.length && (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum usuário com atividade este mês.</div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ── Tab: Leads ────────────────────────────────────────────────────────────────

function LeadsTab() {
  const { data: bySource, isLoading: srcLoading } = useLeadsBySource()
  const { data: byStage, isLoading: stgLoading } = useLeadsByStage()
  const { data: leads, isLoading: leadsLoading } = useReportLeads()

  const totalSource = (bySource ?? []).reduce((s, d) => s + d.count, 0) || 1

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By source */}
        <Card className="p-5">
          <SectionTitle title="Leads por Origem" icon={Zap} />
          {srcLoading ? <LoadingRow /> : (
            <div className="space-y-2.5">
              {(bySource ?? []).map(s => {
                const pct = Math.round((s.count / totalSource) * 100)
                const color = SOURCE_COLORS[s.source.toLowerCase()] ?? '#94a3b8'
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground capitalize">{s.source}</span>
                      <span className="text-muted-foreground">{s.count} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )
              })}
              {!bySource?.length && <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de origem.</p>}
            </div>
          )}
        </Card>

        {/* By stage */}
        <Card className="p-5">
          <SectionTitle title="Leads por Etapa" icon={Target} />
          {stgLoading ? <LoadingRow /> : (
            <div className="space-y-2.5">
              {(byStage ?? []).map(s => {
                const total = (byStage ?? []).reduce((acc, d) => acc + d.count, 0) || 1
                const pct = Math.round((s.count / total) * 100)
                return (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{s.stage}</span>
                      <span className="text-muted-foreground">{s.count} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                )
              })}
              {!byStage?.length && <p className="text-sm text-muted-foreground py-4 text-center">Sem etapas configuradas.</p>}
            </div>
          )}
        </Card>
      </div>

      {/* Leads table */}
      <Card>
        <div className="p-5 border-b border-border">
          <SectionTitle title="Leads Recentes" subtitle="Últimos 20 leads cadastrados" icon={Users} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Origem</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Etapa</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Responsável</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {leadsLoading
                ? [1,2,3,4,5].map(i => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={7} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-muted" /></td>
                    </tr>
                  ))
                : (leads ?? []).map(l => (
                    <tr key={l.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-[140px] truncate">{l.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{l.email ?? l.phone ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] capitalize">{l.source}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.stage ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('text-xs font-medium tabular-nums', l.score >= 70 ? 'text-emerald-500' : l.score >= 40 ? 'text-amber-500' : 'text-muted-foreground')}>
                          {l.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.assigned ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{timeAgo(l.created_at)}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
          {!leadsLoading && !leads?.length && (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ── Tab: Atendimentos ─────────────────────────────────────────────────────────

function AttendanceTab() {
  const { data: convDetail, isLoading } = useConversationsDetail()
  const { data: convSeries } = useConversationsTimeSeries()

  const statusSegments = (convDetail?.byStatus ?? []).map(s => ({
    value: s.count,
    color: STATUS_COLORS[s.status] ?? '#94a3b8',
    label: STATUS_LABELS[s.status] ?? s.status,
  }))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Donut */}
        <Card className="p-5 flex flex-col items-center">
          <SectionTitle title="Status das Conversas" icon={MessageSquare} />
          {isLoading ? <div className="h-28 w-28 rounded-full animate-pulse bg-muted" /> : (
            <>
              <MiniDonut segments={statusSegments} />
              <div className="mt-3 space-y-1.5 w-full">
                {(convDetail?.byStatus ?? []).map(s => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.status] ?? '#94a3b8' }} />
                      <span className="text-muted-foreground">{STATUS_LABELS[s.status] ?? s.status}</span>
                    </div>
                    <span className="font-medium tabular-nums text-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* By sector */}
        <Card className="p-5">
          <SectionTitle title="Por Setor" icon={Activity} />
          {isLoading ? <LoadingRow /> : (
            <div className="space-y-2.5">
              {(convDetail?.bySector ?? []).map((s, i) => {
                const max = Math.max(...(convDetail?.bySector ?? []).map(x => x.count), 1)
                const pct = Math.round((s.count / max) * 100)
                return (
                  <div key={s.sector}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{s.sector}</span>
                      <span className="text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {!convDetail?.bySector?.length && <p className="text-sm text-muted-foreground py-4 text-center">Sem dados por setor.</p>}
            </div>
          )}
        </Card>

        {/* Trend */}
        <Card className="p-5">
          <SectionTitle title="Tendência 30 dias" icon={TrendingUp} />
          <div className="mt-2">
            <Sparkline data={convSeries ?? []} color="#22c55e" height={100} fill />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(['open', 'in_progress', 'closed'] as const).map(s => {
              const item = convDetail?.byStatus?.find(x => x.status === s)
              return (
                <div key={s} className="rounded-lg bg-muted/50 p-2">
                  <p className="text-sm font-bold text-foreground">{item?.count ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">{STATUS_LABELS[s]}</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Tab: Agentes IA ───────────────────────────────────────────────────────────

function AgentsTab() {
  const { data: agents, isLoading } = useAIAgentsStats()

  const PROVIDER_COLORS: Record<string, string> = {
    anthropic: 'bg-orange-500/10 text-orange-500',
    xai:       'bg-gray-500/10 text-gray-400',
    deepseek:  'bg-blue-500/10 text-blue-500',
    openai:    'bg-emerald-500/10 text-emerald-500',
    groq:      'bg-violet-500/10 text-violet-500',
    google:    'bg-yellow-500/10 text-yellow-600',
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Agentes de IA em Operação" subtitle="Atividade este mês" icon={Bot} />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : !agents?.length ? (
        <Card className="py-16 text-center text-sm text-muted-foreground">
          Nenhum agente de IA ativo configurado.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map(a => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.product}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className={cn('text-[10px]', PROVIDER_COLORS[a.provider] ?? '')}>
                    {a.provider}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{a.model}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-sm font-bold text-foreground tabular-nums">{a.messagesThisMonth}</p>
                  <p className="text-[10px] text-muted-foreground">Ações</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-sm font-bold text-foreground tabular-nums">{a.toolExecutions}</p>
                  <p className="text-[10px] text-muted-foreground">Tools</p>
                </div>
                <div className={cn('rounded-lg p-2 text-center', a.errors > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10')}>
                  <p className={cn('text-sm font-bold tabular-nums', a.errors > 0 ? 'text-red-500' : 'text-emerald-500')}>{a.errors}</p>
                  <p className="text-[10px] text-muted-foreground">Erros</p>
                </div>
              </div>

              {/* Success rate bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Taxa de sucesso</span>
                  <span className={cn('font-medium', a.successRate >= 90 ? 'text-emerald-500' : a.successRate >= 70 ? 'text-amber-500' : 'text-red-500')}>
                    {a.successRate}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', a.successRate >= 90 ? 'bg-emerald-500' : a.successRate >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${a.successRate}%` }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Logs & Erros ─────────────────────────────────────────────────────────

function LogsTab() {
  const { data: logs, isLoading, refetch } = useSystemLogs()
  const [filter, setFilter] = useState<'all' | 'error' | 'info'>('all')

  const filtered = (logs ?? []).filter(l => filter === 'all' || l.type === filter)
  const errorCount = (logs ?? []).filter(l => l.type === 'error').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle title="Logs do Sistema" subtitle="Erros de agentes IA + auditoria" icon={AlertTriangle} />
        <div className="flex items-center gap-2">
          {(['all', 'error', 'info'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'all' ? `Todos (${logs?.length ?? 0})` : f === 'error' ? `Erros (${errorCount})` : 'Info'}
            </button>
          ))}
          <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {errorCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-500 font-medium">
            {errorCount} erro{errorCount !== 1 ? 's' : ''} detectado{errorCount !== 1 ? 's' : ''} nos agentes de IA
          </p>
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : !filtered.length ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
            Nenhum log {filter !== 'all' ? 'de ' + filter : ''} encontrado.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(log => {
              const Icon = LOG_ICONS[log.type]
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', LOG_COLORS[log.type])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{log.source}</span>
                      <Badge variant="outline" className={cn('text-[10px]', log.type === 'error' ? 'border-red-500/30 text-red-500' : 'border-blue-500/30 text-blue-400')}>
                        {log.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 line-clamp-1">{log.message}</p>
                    {log.detail && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 font-mono">{log.detail}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">{timeAgo(log.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { data: overview } = usePlatformOverview()
  const now = new Date()

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">Relatórios & Analytics</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Visão completa da plataforma · {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Status pills */}
        <div className="flex gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-foreground font-medium">{overview?.conversationsOpen ?? '—'} conversas ativas</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
            <Bot className="h-3 w-3 text-blue-500" />
            <span className="text-foreground font-medium">{overview?.aiAgentsActive ?? '—'} agentes IA</span>
          </div>
          {(overview?.errorsLast24h ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-red-500 font-medium">{overview?.errorsLast24h} erros (24h)</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex gap-1 bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
          {[
            { value: 'overview',    label: 'Visão Geral',  icon: BarChart3 },
            { value: 'users',       label: 'Usuários',     icon: Users },
            { value: 'leads',       label: 'Leads',        icon: Target },
            { value: 'attendance',  label: 'Atendimentos', icon: MessageSquare },
            { value: 'agents',      label: 'Agentes IA',   icon: Bot },
            { value: 'logs',        label: 'Logs & Erros', icon: AlertTriangle },
          ].map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.value === 'logs' && (overview?.errorsLast24h ?? 0) > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {overview?.errorsLast24h}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5"><OverviewTab /></TabsContent>
        <TabsContent value="users"    className="mt-5"><UsersTab /></TabsContent>
        <TabsContent value="leads"    className="mt-5"><LeadsTab /></TabsContent>
        <TabsContent value="attendance" className="mt-5"><AttendanceTab /></TabsContent>
        <TabsContent value="agents"   className="mt-5"><AgentsTab /></TabsContent>
        <TabsContent value="logs"     className="mt-5"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

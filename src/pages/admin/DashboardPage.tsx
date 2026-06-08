import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDashboardStats, useRecentLeads, useRecentConversations } from '@/hooks/useDashboard'
import { useLeaderboard, useSalesGoals } from '@/hooks/useCommissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users, MessageSquare, DollarSign, Trophy, TrendingUp, TrendingDown,
  Target, Zap, FileText, Calendar, Bot, CreditCard, Building2,
  Inbox, BarChart3, ArrowRight, CheckCircle2, ExternalLink, AppWindow,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  growth?: number
  icon: React.ElementType
  color: string
  loading?: boolean
}

function KpiCard({ label, value, sub, growth, icon: Icon, color, loading }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            {loading
              ? <Skeleton className="mt-2 h-8 w-24" />
              : <p className="mt-1 font-display text-2xl font-bold text-foreground">{value}</p>
            }
            {!loading && (sub || growth !== undefined) && (
              <div className="mt-1 flex items-center gap-1.5">
                {growth !== undefined && (
                  <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', growth >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                    {growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(growth)}%
                  </span>
                )}
                {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
              </div>
            )}
          </div>
          <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Quick access nav ──────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: 'Inbox',       to: '/admin/inbox',       icon: Inbox,       color: 'bg-primary/10 text-primary' },
  { label: 'Leads',       to: '/admin/leads',        icon: Users,       color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Agentes IA',  to: '/admin/agents',       icon: Bot,         color: 'bg-violet-500/10 text-violet-500' },
  { label: 'Calendário',  to: '/admin/calendar',     icon: Calendar,    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Funis',       to: '/admin/funnels',      icon: Zap,         color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Forms',       to: '/admin/forms',        icon: FileText,    color: 'bg-teal-500/10 text-teal-500' },
  { label: 'Pagamentos',  to: '/admin/payments',     icon: CreditCard,  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Comissões',   to: '/admin/commissions',  icon: DollarSign,  color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Produtos',    to: '/admin/products',     icon: BarChart3,   color: 'bg-cyan-500/10 text-cyan-500' },
  { label: 'Setores',     to: '/admin/sectors',      icon: Building2,   color: 'bg-indigo-500/10 text-indigo-500' },
]

function WhatsAppQuickBtn() {
  return (
    <a
      href="https://web.whatsapp.com"
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-emerald-50 transition-colors text-center ring-1 ring-emerald-200"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 shadow-sm">
        <MessageSquare className="h-4 w-4 text-white" />
      </div>
      <span className="text-[10px] font-semibold text-emerald-600 leading-tight">WhatsApp</span>
    </a>
  )
}

const APP_LINKS = [
  { label: 'Painel.chatatender.ia.br',        href: 'https://painel.chatatender.ia.br' },
  { label: 'ia.chatatender.com.br',           href: 'https://ia.chatatender.com.br' },
  { label: 'webhook.chatatender.ia.br/login', href: 'https://webhook.chatatender.ia.br/login' },
  { label: 'ia.advogadosdefesa.com.br',       href: 'https://ia.advogadosdefesa.com.br' },
]

function AppsButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-accent transition-colors text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500">
            <AppWindow className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground leading-tight">APPs IA</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        {APP_LINKS.map(app => (
          <DropdownMenuItem key={app.href} asChild>
            <a href={app.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 cursor-pointer">
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="text-xs truncate">{app.label}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function QuickAccess() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Acesso rápido</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-5 gap-2">
        {QUICK_LINKS.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-accent transition-colors text-center"
          >
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', l.color)}>
              <l.icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground leading-tight">{l.label}</span>
          </Link>
        ))}
        <WhatsAppQuickBtn />
        <AppsButton />
      </CardContent>
    </Card>
  )
}

// ── Recent Leads ──────────────────────────────────────────────────────────────

function RecentLeadsCard() {
  const { data = [], isLoading } = useRecentLeads()

  const sourceLabel: Record<string, string> = {
    whatsapp: 'WhatsApp',
    form: 'Form',
    manual: 'Manual',
    api: 'API',
    funnel: 'Funil',
    import: 'Import',
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Leads recentes</CardTitle>
        <Link to="/admin/leads" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          : data.length === 0
            ? <p className="text-xs text-muted-foreground py-4 text-center">Nenhum lead ainda.</p>
            : data.map(lead => (
              <div key={lead.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(lead.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{lead.email ?? lead.phone ?? '—'}</p>
                </div>
                <div className="flex-shrink-0 text-right space-y-0.5">
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {sourceLabel[lead.source] ?? lead.source}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(lead.created_at)}</p>
                </div>
              </div>
            ))
        }
      </CardContent>
    </Card>
  )
}

// ── Recent Conversations ──────────────────────────────────────────────────────

function RecentConversationsCard() {
  const { data = [], isLoading } = useRecentConversations()

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Conversas abertas</CardTitle>
        <Link to="/admin/inbox" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Inbox <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          : data.length === 0
            ? <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma conversa aberta.</p>
            : data.map(conv => (
              <Link
                key={conv.id}
                to="/admin/inbox"
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors"
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{conv.contact_name ?? 'Desconhecido'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{conv.last_message ?? '—'}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                  {conv.unread_count > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] text-white font-bold px-1">
                      {conv.unread_count}
                    </span>
                  )}
                  <p className="text-[10px] text-muted-foreground">{timeAgo(conv.last_message_at)}</p>
                </div>
              </Link>
            ))
        }
      </CardContent>
    </Card>
  )
}

// ── Leaderboard preview ───────────────────────────────────────────────────────

function LeaderboardCard() {
  const { data = [], isLoading } = useLeaderboard('month')

  const medalColor = ['text-amber-500', 'text-slate-400', 'text-orange-700']

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Ranking do mês</CardTitle>
        <Link to="/admin/commissions" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          : data.length === 0
            ? <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma venda este mês.</p>
            : data.slice(0, 5).map((entry, i) => (
              <div key={entry.user_id} className="flex items-center gap-3">
                <span className={cn('w-5 text-center text-sm font-bold flex-shrink-0', medalColor[i] ?? 'text-muted-foreground')}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${entry.rank}`}
                </span>
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(entry.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{entry.full_name ?? 'Usuário'}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.deals_won} vendas</p>
                </div>
                <p className="text-xs font-semibold text-foreground flex-shrink-0">{fmt(entry.revenue)}</p>
              </div>
            ))
        }
      </CardContent>
    </Card>
  )
}

// ── Goals progress ────────────────────────────────────────────────────────────

function GoalsCard() {
  const { data: goals = [], isLoading } = useSalesGoals()
  const active = goals.slice(0, 4)

  const metricLabel: Record<string, string> = {
    revenue: 'Receita',
    deals_count: 'Negócios',
    leads_count: 'Leads',
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Metas ativas</CardTitle>
        <Link to="/admin/commissions" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Gerenciar <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          : active.length === 0
            ? <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma meta ativa.</p>
            : active.map(goal => {
              const pct = Math.min(100, Math.round(((goal as any).__progress ?? 0) / goal.target_value * 100))
              return (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground truncate flex-1">{goal.title}</p>
                    <Badge variant="outline" className="text-[10px] ml-2 flex-shrink-0">
                      {metricLabel[goal.metric] ?? goal.metric}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-primary')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right flex-shrink-0">{pct}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Meta: {goal.metric === 'revenue' ? fmt(goal.target_value) : fmtShort(goal.target_value)}
                    {' · '}
                    {goal.profiles?.full_name ?? goal.sales_squads?.name ?? 'Equipe'}
                  </p>
                </div>
              )
            })
        }
      </CardContent>
    </Card>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()
  const { user } = useAuth()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{greeting()}, {user?.email?.split('@')[0]} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Aqui está o resumo da sua operação hoje.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Sistema operacional
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Leads este mês"
          value={isLoading ? '—' : String(stats?.leadsThisMonth ?? 0)}
          sub="vs. mês anterior"
          growth={stats?.leadsGrowth}
          icon={Users}
          color="bg-blue-500"
          loading={isLoading}
        />
        <KpiCard
          label="Conversas abertas"
          value={isLoading ? '—' : String(stats?.openConversations ?? 0)}
          sub="aguardando resposta"
          icon={MessageSquare}
          color="bg-primary"
          loading={isLoading}
        />
        <KpiCard
          label="Receita este mês"
          value={isLoading ? '—' : fmt(stats?.revenueThisMonth ?? 0)}
          sub="vs. mês anterior"
          growth={stats?.revenueGrowth}
          icon={TrendingUp}
          color="bg-emerald-500"
          loading={isLoading}
        />
        <KpiCard
          label="Comissões pendentes"
          value={isLoading ? '—' : fmt(stats?.pendingCommissions ?? 0)}
          sub={`${stats?.dealsWonThisMonth ?? 0} vendas fechadas`}
          icon={Trophy}
          color="bg-amber-500"
          loading={isLoading}
        />
      </div>

      {/* Quick Access */}
      <QuickAccess />

      {/* 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentLeadsCard />
        <RecentConversationsCard />
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeaderboardCard />
        <GoalsCard />
      </div>

      {/* Footer note */}
      <p className="text-center text-[11px] text-muted-foreground pb-2">
        Dados atualizados em tempo real via Supabase · ChatAtender
      </p>
    </div>
  )
}

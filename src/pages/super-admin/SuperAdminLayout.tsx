import { useState } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, type ProfileData } from '@/hooks/useProfile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, Users, CreditCard, Receipt, Package,
  Megaphone, BookOpen, LifeBuoy, Palette, Mail, Settings,
  Sparkles, Bot, ScrollText, Activity, LogOut, User, ChevronLeft,
  ShieldCheck, ArrowLeft,
} from 'lucide-react'

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  group?: string
}

const NAV: NavItem[] = [
  // Platform
  { label: 'Dashboard',        to: '/super-admin',               icon: LayoutDashboard, group: 'Plataforma' },
  { label: 'Organizações',     to: '/super-admin/organizations',  icon: Building2 },
  { label: 'Usuários',         to: '/super-admin/users',          icon: Users },
  { label: 'System Health',    to: '/super-admin/health',         icon: Activity },
  // Billing
  { label: 'Planos & Preços',  to: '/super-admin/plans',          icon: Package,    group: 'Billing' },
  { label: 'Assinaturas',      to: '/super-admin/subscriptions',  icon: Receipt },
  { label: 'Billing',          to: '/super-admin/billing',        icon: CreditCard },
  // Content
  { label: 'Releases',         to: '/super-admin/releases',       icon: Megaphone,  group: 'Conteúdo' },
  { label: 'Help Articles',    to: '/super-admin/help',           icon: BookOpen },
  { label: 'Suporte',          to: '/super-admin/support',        icon: LifeBuoy },
  // Config
  { label: 'Branding',         to: '/super-admin/branding',       icon: Palette,    group: 'Config' },
  { label: 'Email Settings',   to: '/super-admin/email',          icon: Mail },
  { label: 'Plataforma',       to: '/super-admin/settings',       icon: Settings },
  // AI
  { label: 'AI Quality',       to: '/super-admin/ai-quality',     icon: Sparkles,   group: 'IA' },
  { label: 'Tool Executions',  to: '/super-admin/executions',     icon: Bot },
  { label: 'Audit Logs',       to: '/super-admin/audit',          icon: ScrollText },
]

function SidebarItem({ item }: { item: NavItem }) {
  const location = useLocation()
  const isActive = item.to === '/super-admin'
    ? location.pathname === '/super-admin'
    : location.pathname.startsWith(item.to)
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
        isActive
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{item.label}</span>
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-primary" />}
    </Link>
  )
}

function CollapsedNav() {
  const location = useLocation()
  return (
    <div className="space-y-1">
      {NAV.map(item => {
        const Icon = item.icon
        const isActive = item.to === '/super-admin'
          ? location.pathname === '/super-admin'
          : location.pathname.startsWith(item.to)
        return (
          <Link key={item.to} to={item.to} title={item.label}
            className={cn('flex items-center justify-center h-8 w-8 mx-auto rounded-lg transition-colors',
              isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent')}
          >
            <Icon className="h-3.5 w-3.5" />
          </Link>
        )
      })}
    </div>
  )
}

export function SuperAdminLayout() {
  const { user, signOut } = useAuth()
  const { data: profileRaw } = useProfile(user?.id)
  const profile = profileRaw as ProfileData | null | undefined
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'SA'

  const groups = NAV.reduce<{ group: string; items: NavItem[] }[]>((acc, item) => {
    if (item.group) acc.push({ group: item.group, items: [item] })
    else acc[acc.length - 1]?.items.push(item)
    return acc
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col h-full border-r border-border transition-all duration-200 bg-card',
        collapsed ? 'w-12' : 'w-52'
      )}>
        {/* Header */}
        <div className={cn('flex items-center gap-2 p-3 border-b border-border', collapsed && 'justify-center')}>
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-primary">
            <ShieldCheck className="h-3.5 w-3.5 text-white" />
          </div>
          {!collapsed && <span className="font-display text-sm font-bold text-foreground">Super Admin</span>}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
          {collapsed
            ? <CollapsedNav />
            : groups.map(g => (
              <div key={g.group}>
                <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{g.group}</p>
                <div className="space-y-0.5 relative">
                  {g.items.map(item => <SidebarItem key={item.to} item={item} />)}
                </div>
              </div>
            ))
          }
        </div>

        {/* Footer */}
        <div className="p-1.5 border-t border-border space-y-1">
          <Link to="/admin" className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors',
            collapsed && 'justify-center'
          )}>
            <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span>Painel Admin</span>}
          </Link>
          <button onClick={() => setCollapsed(v => !v)} className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors',
            collapsed && 'justify-center'
          )}>
            <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-600">
              <ShieldCheck className="h-3 w-3" />
              Super Admin
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-xs font-medium truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="h-3.5 w-3.5" /> Meu perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await signOut(); navigate('/login') }} className="text-destructive focus:text-destructive">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

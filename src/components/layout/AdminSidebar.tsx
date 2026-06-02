import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Building2, Users, MessageSquare,
  Calendar, Megaphone, FileText, Settings, ChevronLeft,
  Inbox, BarChart3, Zap, Target, DollarSign, Bot, CreditCard,
} from 'lucide-react'

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  soon?: boolean
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Inbox', to: '/admin/inbox', icon: Inbox },
  { label: 'Leads & CRM', to: '/admin/leads', icon: Users },
  { label: 'Pipeline', to: '/admin/pipeline', icon: Target, soon: true },
  { label: 'Agentes IA', to: '/admin/agents', icon: Bot },
  { label: 'Calendário', to: '/admin/calendar', icon: Calendar },
  { label: 'Funis', to: '/admin/funnels', icon: Zap },
  { label: 'Forms', to: '/admin/forms', icon: FileText },
  { label: 'Pagamentos', to: '/admin/payments', icon: CreditCard },
  { label: 'Relatórios', to: '/admin/reports', icon: BarChart3, soon: true },
]

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Setores', to: '/admin/sectors', icon: Building2, adminOnly: true },
  { label: 'Equipe', to: '/admin/team', icon: Users, adminOnly: true, soon: true },
  { label: 'Produtos', to: '/admin/products', icon: Megaphone, adminOnly: true },
  { label: 'Comissões', to: '/admin/commissions', icon: DollarSign, adminOnly: true, soon: true },
  { label: 'WhatsApp', to: '/admin/whatsapp', icon: MessageSquare, adminOnly: true },
  { label: 'Configurações', to: '/admin/settings', icon: Settings, adminOnly: true, soon: true },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation()
  const isActive = item.to === '/admin'
    ? location.pathname === '/admin'
    : location.pathname.startsWith(item.to)
  const Icon = item.icon

  return (
    <NavLink
      to={item.soon ? '#' : item.to}
      onClick={e => item.soon && e.preventDefault()}
      className={cn(
        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-primary/15 text-primary'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
        item.soon && 'opacity-50 cursor-not-allowed',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
      {!collapsed && (
        <span className="flex-1 truncate">{item.label}</span>
      )}
      {!collapsed && item.soon && (
        <span className="text-[10px] rounded bg-muted px-1 py-0.5 text-muted-foreground font-normal">
          Em breve
        </span>
      )}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary" />
      )}
    </NavLink>
  )
}

export function AdminSidebar({ collapsed, onToggle }: SidebarProps) {
  const { isAdmin } = useAuth()

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {/* Navegação principal */}
        <div className="space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavItemLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>

        {/* Seção Admin */}
        {isAdmin && (
          <div className="pt-3">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administração
              </p>
            )}
            {collapsed && <div className="h-px bg-sidebar-border my-2 mx-2" />}
            <div className="space-y-0.5">
              {ADMIN_ITEMS.map(item => (
                <NavItemLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botão colapsar */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground',
            'hover:bg-sidebar-accent hover:text-foreground transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  )
}

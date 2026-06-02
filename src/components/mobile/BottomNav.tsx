import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Inbox, Users, Bot, Bell } from 'lucide-react'
import { useUnreadCount } from '@/hooks/useNotifications'
import { haptic } from '@/hooks/usePWA'

const NAV = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Home',    exact: true },
  { to: '/admin/inbox',        icon: Inbox,           label: 'Inbox',   exact: false },
  { to: '/admin/leads',        icon: Users,           label: 'Leads',   exact: false },
  { to: '/admin/agents',       icon: Bot,             label: 'Agentes', exact: false },
  { to: '/admin/notifications',icon: Bell,            label: 'Alertas', exact: false },
]

export function BottomNav() {
  const location = useLocation()
  const { data: unread = 0 } = useUnreadCount()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur-md safe-area-pb">
      {NAV.map(({ to, icon: Icon, label, exact }) => {
        const active = exact ? location.pathname === to : location.pathname.startsWith(to)
        const isNotif = to.includes('notifications')
        return (
          <NavLink
            key={to}
            to={to}
            onClick={() => haptic('light')}
            className={cn(
              'relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className="relative">
              <Icon className={cn('h-5 w-5 transition-transform', active && 'scale-110')} />
              {isNotif && unread > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <span className={cn('text-[10px] font-medium leading-none', active ? 'text-primary' : 'text-muted-foreground')}>
              {label}
            </span>
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

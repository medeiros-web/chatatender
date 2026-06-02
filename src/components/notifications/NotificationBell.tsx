import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  useNotifications, useUnreadCount, useMarkRead, useMarkAllRead,
  useRealtimeNotifications, useNotifSettings,
  type Notification,
} from '@/hooks/useNotifications'

// ── Notification icon by type ─────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  lead_created:     'bg-blue-500/15 text-blue-500',
  lead_assigned:    'bg-indigo-500/15 text-indigo-500',
  message_received: 'bg-green-500/15 text-green-500',
  mention:          'bg-orange-500/15 text-orange-500',
  deal_won:         'bg-emerald-500/15 text-emerald-500',
  goal:             'bg-yellow-500/15 text-yellow-500',
  system:           'bg-muted text-muted-foreground',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ── Single notification row ───────────────────────────────────────────────────

function NotifRow({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const dotColor = TYPE_COLOR[n.type] ?? TYPE_COLOR.system

  return (
    <button
      onClick={() => !n.is_read && onRead(n.id)}
      className={cn(
        'w-full text-left flex gap-3 items-start px-4 py-3 hover:bg-accent/50 transition-colors',
        !n.is_read && 'bg-primary/5'
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5 h-2 w-2 rounded-full', !n.is_read ? 'bg-primary' : 'bg-transparent')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !n.is_read ? 'font-medium text-foreground' : 'text-foreground/80')}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
        )}
        <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <div className={cn('flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px]', dotColor)}>
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  )
}

// ── Main bell component ───────────────────────────────────────────────────────

export function NotificationBell() {
  const navigate = useNavigate()
  const { data: notifications = [] } = useNotifications()
  const { data: unread = 0 } = useUnreadCount()
  const { data: settings } = useNotifSettings()
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const [open, setOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Realtime — play sound + show badge on new notification
  useRealtimeNotifications((n) => {
    if (settings?.sound_enabled !== false) {
      const soundUrl = settings?.sound_url || '/notification.mp3'
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(soundUrl)
          audioRef.current.volume = 0.5
        }
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      } catch {}
    }
    // Browser notification if permission granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(n.title, { body: n.body ?? undefined, icon: '/favicon.ico' })
    }
  })

  const handleMarkRead = (id: string) => markRead.mutate(id)
  const handleMarkAll = () => markAll.mutate()

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative text-muted-foreground">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive flex items-center justify-center text-[10px] font-bold text-white px-0.5">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-foreground" />
            <span className="font-semibold text-sm text-foreground">Notificações</span>
            {unread > 0 && (
              <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={handleMarkAll}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Todas lidas
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map(n => (
              <NotifRow key={n.id} n={n} onRead={handleMarkRead} />
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setOpen(false); navigate('/admin/notifications') }}
            >
              Ver todas as notificações
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

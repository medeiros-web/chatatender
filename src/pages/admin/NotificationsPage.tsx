import { useState } from 'react'
import { Bell, Settings, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  useNotifications, useUnreadCount, useMarkAllRead,
  useNotifSettings, useUpsertNotifSettings,
  type Notification, type UserNotifSettings,
} from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

const TYPE_LABEL: Record<string, string> = {
  lead_created:     'Novo lead',
  lead_assigned:    'Lead atribuído',
  message_received: 'Nova mensagem',
  mention:          'Menção',
  deal_won:         'Negócio fechado',
  goal:             'Meta atingida',
  system:           'Sistema',
}

const TYPE_DOT: Record<string, string> = {
  lead_created:     'bg-blue-500',
  lead_assigned:    'bg-indigo-500',
  message_received: 'bg-green-500',
  mention:          'bg-orange-500',
  deal_won:         'bg-emerald-500',
  goal:             'bg-yellow-500',
  system:           'bg-muted-foreground',
}

function NotifCard({ n }: { n: Notification }) {
  return (
    <div className={cn(
      'flex gap-3 rounded-xl border border-border p-4 transition-colors',
      !n.is_read && 'bg-primary/5 border-primary/20'
    )}>
      <div className={cn('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', TYPE_DOT[n.type] ?? 'bg-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', !n.is_read ? 'font-semibold text-foreground' : 'text-foreground/80')}>
            {n.title}
          </p>
          <span className="flex-shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
        </div>
        {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
        <span className="mt-1.5 inline-block text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          {TYPE_LABEL[n.type] ?? n.type}
        </span>
      </div>
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────────────────────

function NotifSettingsPanel() {
  const { data: settings } = useNotifSettings()
  const upsert = useUpsertNotifSettings()
  const [soundUrl, setSoundUrl] = useState(settings?.sound_url ?? '')

  const toggle = (key: keyof UserNotifSettings) => {
    if (!settings) return
    upsert.mutate({ [key]: !(settings as unknown as Record<string, unknown>)[key] } as Partial<UserNotifSettings>)
  }

  const TOGGLES: { key: keyof UserNotifSettings; label: string }[] = [
    { key: 'email_on_lead_assigned', label: 'E-mail ao receber lead atribuído' },
    { key: 'email_on_message',       label: 'E-mail ao receber nova mensagem' },
    { key: 'email_on_mention',       label: 'E-mail ao ser mencionado' },
    { key: 'email_on_deal_won',      label: 'E-mail ao fechar negócio' },
    { key: 'sound_enabled',          label: 'Som nas notificações em tempo real' },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Preferências de notificação</h2>
      </div>

      <div className="space-y-4">
        {TOGGLES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{label}</span>
            <Switch
              checked={!!settings?.[key]}
              onCheckedChange={() => toggle(key)}
              disabled={upsert.isPending}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <label className="text-sm font-medium text-foreground">URL do som personalizado</label>
        <div className="flex gap-2">
          <Input
            value={soundUrl}
            onChange={e => setSoundUrl(e.target.value)}
            placeholder="https://example.com/notification.mp3"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => upsert.mutate({ sound_url: soundUrl || null })}
            disabled={upsert.isPending}
          >
            Salvar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Deixe em branco para usar o padrão (MP3 ou OGG)</p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: unread = 0 } = useUnreadCount()
  const markAll = useMarkAllRead()
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const displayed = tab === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unread > 0 ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Todas lidas'}
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['all', 'unread'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'all' ? 'Todas' : `Não lidas${unread > 0 ? ` (${unread})` : ''}`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{tab === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</p>
          </div>
        ) : (
          displayed.map(n => <NotifCard key={n.id} n={n} />)
        )}
      </div>

      {/* Settings */}
      <NotifSettingsPanel />
    </div>
  )
}

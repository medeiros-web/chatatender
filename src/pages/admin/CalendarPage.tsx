import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  format, parseISO, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, Edit2, Trash2, Copy, ExternalLink, Calendar,
  Clock, MapPin, Link2, Check, X, RefreshCw, ChevronLeft,
  ChevronRight, AlertCircle, LogIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  useBookingEventTypes, useCreateBookingEventType, useUpdateBookingEventType,
  useDeleteBookingEventType, useBookingRequests, useUpdateBookingStatus,
  useBusinessHours, useSaveBusinessHours, useBusinessHolidays,
  useCreateHoliday, useDeleteHoliday, useGoogleCalendarConnection,
  useInitiateGoogleAuth, useSyncGoogleCalendar, useCalendarEvents,
  useDisconnectGoogleCalendar, usePushBookingToGoogle,
} from '@/hooks/useBooking'
import type { BookingEventType, BookingRequest, BusinessHour } from '@/hooks/useBooking'
import { cn } from '@/lib/utils'

// ── Schema ────────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const eventTypeSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  description: z.string().optional(),
  duration_minutes: z.number().min(5).max(480),
  location: z.string().optional(),
  color: z.string(),
  buffer_before_minutes: z.number().min(0),
  buffer_after_minutes: z.number().min(0),
  is_active: z.boolean(),
})

type EventTypeForm = z.infer<typeof eventTypeSchema>

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingRequest['status'], string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

const STATUS_VARIANTS: Record<BookingRequest['status'], string> = {
  pending: 'bg-warning/15 text-warning',
  confirmed: 'bg-success/15 text-success',
  cancelled: 'bg-muted text-muted-foreground',
  no_show: 'bg-destructive/15 text-destructive',
}

// ── Event Type Dialog ─────────────────────────────────────────────────────────

function EventTypeDialog({
  open, onClose, editing,
}: {
  open: boolean
  onClose: () => void
  editing: BookingEventType | null
}) {
  const create = useCreateBookingEventType()
  const update = useUpdateBookingEventType()

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<EventTypeForm>({
    resolver: zodResolver(eventTypeSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          slug: editing.slug,
          description: editing.description ?? undefined,
          duration_minutes: editing.duration_minutes,
          location: editing.location ?? undefined,
          color: editing.color,
          buffer_before_minutes: editing.buffer_before_minutes,
          buffer_after_minutes: editing.buffer_after_minutes,
          is_active: editing.is_active,
        }
      : {
          duration_minutes: 30,
          color: '#6366f1',
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          is_active: true,
        },
  })

  const isActive = watch('is_active')

  const onSubmit = async (values: EventTypeForm) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...values })
    } else {
      await create.mutateAsync(values)
    }
    reset()
    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar' : 'Novo'} tipo de evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input {...register('name')} placeholder="Reunião de 30 min" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Slug *</label>
              <Input {...register('slug')} placeholder="reuniao-30min" />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Textarea {...register('description')} rows={2} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Duração (min)</label>
              <Input type="number" {...register('duration_minutes', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Buffer antes</label>
              <Input type="number" {...register('buffer_before_minutes', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Buffer depois</label>
              <Input type="number" {...register('buffer_after_minutes', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Local / Tipo</label>
              <Input {...register('location')} placeholder="Google Meet, Zoom, Telefone..." />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cor</label>
              <div className="flex gap-2 items-center">
                <input type="color" {...register('color')} className="h-9 w-14 rounded cursor-pointer" />
                <span className="text-sm text-muted-foreground">{watch('color')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={v => setValue('is_active', v)} />
            <label className="text-sm">Ativo</label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Visual Calendar Tab ───────────────────────────────────────────────────────

function CalendarViewTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const monthKey = format(currentMonth, 'yyyy-MM')
  const { data: events = [] } = useCalendarEvents(monthKey)
  const { data: bookings = [] } = useBookingRequests()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const monthBookings = bookings.filter(b => {
    const d = parseISO(b.requested_at)
    return isSameMonth(d, currentMonth)
  })

  const dayBookings = (day: Date) =>
    monthBookings.filter(b => isSameDay(parseISO(b.requested_at), day))

  const dayGoogleEvents = (day: Date) =>
    events.filter(e => e.source === 'google' && isSameDay(parseISO(e.start_at), day))

  const selBookings = selectedDay ? dayBookings(selectedDay) : []
  const selEvents = selectedDay ? dayGoogleEvents(selectedDay) : []

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-sm capitalize">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground pb-2">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const bkgs = dayBookings(day)
          const gevts = dayGoogleEvents(day)
          const total = bkgs.length + gevts.length
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const inMonth = isSameMonth(day, currentMonth)

          return (
            <button
              key={day.toISOString()}
              onClick={() => inMonth && setSelectedDay(isSelected ? null : day)}
              className={cn(
                'rounded-lg p-1.5 min-h-[60px] text-left transition-colors text-xs',
                !inMonth && 'opacity-25 pointer-events-none',
                isToday(day) && 'bg-primary/10',
                isSelected && 'ring-2 ring-primary bg-primary/5',
                inMonth && !isSelected && 'hover:bg-muted/50',
              )}
            >
              <span className={cn('font-medium', isToday(day) && 'text-primary font-bold')}>
                {format(day, 'd')}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {bkgs.slice(0, 2).map(b => (
                  <div
                    key={b.id}
                    className="truncate rounded px-1 text-[10px]"
                    style={{
                      backgroundColor: ((b.booking_event_types as any)?.color ?? '#6366f1') + '30',
                      color: (b.booking_event_types as any)?.color ?? '#6366f1',
                    }}
                  >
                    {format(parseISO(b.requested_at), 'HH:mm')} {b.requester_name}
                  </div>
                ))}
                {gevts.slice(0, Math.max(0, 2 - bkgs.length)).map(e => (
                  <div key={e.id} className="truncate rounded px-1 text-[10px] bg-blue-500/15 text-blue-600">
                    {format(parseISO(e.start_at), 'HH:mm')} {e.title}
                  </div>
                ))}
                {total > 2 && (
                  <div className="text-[9px] text-muted-foreground px-1">+{total - 2} mais</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="border border-border rounded-lg p-3 space-y-2">
          <h4 className="text-sm font-semibold capitalize">
            {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h4>
          {selBookings.length === 0 && selEvents.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum evento neste dia.</p>
          )}
          {selBookings.map(b => (
            <div key={b.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/50">
              <div
                className="w-1.5 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: (b.booking_event_types as any)?.color ?? '#6366f1' }}
              />
              <div className="flex-1">
                <p className="font-medium">{b.requester_name}</p>
                <p className="text-muted-foreground">
                  {format(parseISO(b.requested_at), 'HH:mm')} · {(b.booking_event_types as any)?.name}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_VARIANTS[b.status]}`}>
                {STATUS_LABELS[b.status]}
              </span>
            </div>
          ))}
          {selEvents.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-blue-500/10">
              <div className="w-1.5 h-10 rounded-full flex-shrink-0 bg-blue-500" />
              <div className="flex-1">
                <p className="font-medium">{e.title}</p>
                <p className="text-muted-foreground">
                  {format(parseISO(e.start_at), 'HH:mm')} – {format(parseISO(e.end_at), 'HH:mm')} · Google Calendar
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Booking Links Tab ────────────────────────────────────────────────────────

function BookingLinksTab() {
  const { data: eventTypes = [], isLoading } = useBookingEventTypes()
  const [copied, setCopied] = useState<string | null>(null)

  const baseUrl = window.location.origin

  const copyLink = async (slug: string) => {
    await navigator.clipboard.writeText(`${baseUrl}/booking/${slug}`)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  const activeTypes = eventTypes.filter(et => et.is_active)

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
        Envie um link de agendamento ao cliente — ele escolhe o dia, mês e horário diretamente, sem precisar de login.
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {activeTypes.length === 0 && !isLoading && (
        <div className="text-center py-10 text-muted-foreground">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum tipo de evento ativo. Crie um na aba Tipos de Evento.</p>
        </div>
      )}

      <div className="space-y-3">
        {activeTypes.map(et => {
          const link = `${baseUrl}/booking/${et.slug}`
          const isCopied = copied === et.slug

          return (
            <div key={et.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="w-3 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: et.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{et.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {et.duration_minutes} min
                    </span>
                    {et.location && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {et.location}
                      </span>
                    )}
                  </div>
                  {et.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{et.description}</p>
                  )}
                </div>
              </div>

              {/* Link row */}
              <div className="flex items-center gap-2 px-3 pb-3">
                <div className="flex-1 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 min-w-0">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground truncate font-mono">{link}</span>
                </div>
                <Button
                  size="sm"
                  variant={isCopied ? 'default' : 'outline'}
                  className="flex-shrink-0 gap-1 h-8 text-xs"
                  onClick={() => copyLink(et.slug)}
                >
                  {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {isCopied ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => window.open(link, '_blank')}
                  title="Abrir página de agendamento"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* WhatsApp share hint */}
      {activeTypes.length > 0 && (
        <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Como enviar para o cliente:</p>
          <p>1. Copie o link do tipo de evento desejado acima.</p>
          <p>2. Cole no WhatsApp, e-mail ou qualquer canal.</p>
          <p>3. O cliente abre o link, escolhe o dia e horário e confirma — tudo sem login.</p>
        </div>
      )}
    </div>
  )
}

// ── Event Types Tab ───────────────────────────────────────────────────────────

function EventTypesTab() {
  const { data: eventTypes = [], isLoading } = useBookingEventTypes()
  const deleteET = useDeleteBookingEventType()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BookingEventType | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const baseUrl = window.location.origin

  const copyLink = async (slug: string) => {
    await navigator.clipboard.writeText(`${baseUrl}/booking/${slug}`)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Crie tipos de evento para que leads agendem reuniões diretamente.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Tipo
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {eventTypes.map(et => (
          <div
            key={et.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
          >
            <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: et.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{et.name}</span>
                {!et.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {et.duration_minutes} min
                </span>
                {et.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {et.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> /booking/{et.slug}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon" variant={copied === et.slug ? 'default' : 'ghost'} className="h-8 w-8"
                onClick={() => copyLink(et.slug)} title="Copiar link"
              >
                {copied === et.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(`/booking/${et.slug}`, '_blank')} title="Abrir página">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(et); setDialogOpen(true) }}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteET.mutate(et.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {!isLoading && eventTypes.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum tipo de evento criado.</p>
          </div>
        )}
      </div>

      <EventTypeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />
    </div>
  )
}

// ── Bookings Tab ──────────────────────────────────────────────────────────────

function BookingsTab() {
  const { data: bookings = [], isLoading } = useBookingRequests()
  const updateStatus = useUpdateBookingStatus()
  const pushToGoogle = usePushBookingToGoogle()
  const { data: gcalConn } = useGoogleCalendarConnection()

  const [filter, setFilter] = useState<BookingRequest['status'] | 'all'>('all')

  const now = new Date()
  const pending = bookings.filter(b => b.status === 'pending').length
  const confirmed = bookings.filter(b => b.status === 'confirmed').length
  const thisMonth = bookings.filter(b => {
    const d = parseISO(b.requested_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border bg-card text-center">
          <p className="text-2xl font-bold text-warning">{pending}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pendentes</p>
        </div>
        <div className="p-3 rounded-lg border bg-card text-center">
          <p className="text-2xl font-bold text-success">{confirmed}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Confirmados</p>
        </div>
        <div className="p-3 rounded-lg border bg-card text-center">
          <p className="text-2xl font-bold">{thisMonth}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Este mês</p>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'confirmed', 'cancelled', 'no_show'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'text-xs px-3 py-1 rounded-full border transition-colors',
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {filtered.map(b => (
        <div key={b.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{b.requester_name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_VARIANTS[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{b.requester_email}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground flex-shrink-0">
              {format(parseISO(b.requested_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>

          {b.booking_event_types && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (b.booking_event_types as any).color }} />
              {(b.booking_event_types as any).name} — {(b.booking_event_types as any).duration_minutes} min
            </div>
          )}

          {b.notes && <p className="text-xs bg-muted rounded px-2 py-1">{b.notes}</p>}

          <div className="flex gap-2 flex-wrap items-center">
            {b.status === 'pending' && (
              <>
                <Button
                  size="sm" variant="outline" className="h-7 text-xs gap-1 text-success border-success/30"
                  onClick={() => updateStatus.mutate({ id: b.id, status: 'confirmed' })}
                  disabled={updateStatus.isPending}
                >
                  <Check className="h-3 w-3" /> Confirmar
                </Button>
                <Button
                  size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                  onClick={() => updateStatus.mutate({ id: b.id, status: 'cancelled' })}
                  disabled={updateStatus.isPending}
                >
                  <X className="h-3 w-3" /> Cancelar
                </Button>
              </>
            )}
            {b.status === 'confirmed' && gcalConn?.is_active && !b.calendar_event_id && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => pushToGoogle.mutate(b.id)}
                disabled={pushToGoogle.isPending}
              >
                <Calendar className="h-3 w-3" />
                {pushToGoogle.isPending ? 'Criando...' : 'Criar no Google Calendar'}
              </Button>
            )}
            {b.calendar_event_id && (
              <span className="text-[10px] text-success flex items-center gap-1">
                <Check className="h-3 w-3" /> No Google Calendar
              </span>
            )}
          </div>
        </div>
      ))}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            Nenhum agendamento {filter !== 'all' ? STATUS_LABELS[filter as BookingRequest['status']].toLowerCase() : ''} encontrado.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Business Hours Tab ────────────────────────────────────────────────────────

function BusinessHoursTab() {
  const { data: hours = [] } = useBusinessHours()
  const saveHours = useSaveBusinessHours()
  const { data: holidays = [] } = useBusinessHolidays()
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()

  const [localHours, setLocalHours] = useState<BusinessHour[]>([])
  const [newHoliday, setNewHoliday] = useState({ holiday_date: '', name: '', is_recurring: false })

  if (hours.length > 0 && localHours.length === 0) {
    setLocalHours(hours)
  }

  const updateHour = (idx: number, field: keyof BusinessHour, value: any) => {
    setLocalHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Horário de atendimento</h3>
        {localHours.map((h, i) => (
          <div key={h.day_of_week} className="flex items-center gap-3">
            <span className="w-8 text-sm font-medium">{DAY_NAMES[h.day_of_week]}</span>
            <Switch checked={h.is_open} onCheckedChange={v => updateHour(i, 'is_open', v)} />
            {h.is_open ? (
              <>
                <Input
                  type="time" value={h.start_time}
                  onChange={e => updateHour(i, 'start_time', e.target.value)}
                  className="w-32"
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="time" value={h.end_time}
                  onChange={e => updateHour(i, 'end_time', e.target.value)}
                  className="w-32"
                />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Fechado</span>
            )}
          </div>
        ))}
        <Button size="sm" onClick={() => saveHours.mutate(localHours as any)} disabled={saveHours.isPending}>
          {saveHours.isPending ? 'Salvando...' : 'Salvar horários'}
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Feriados e indisponibilidades</h3>
        {holidays.map(h => (
          <div key={h.id} className="flex items-center justify-between p-2 rounded border border-border">
            <div>
              <span className="text-sm font-medium">{h.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {format(new Date(h.holiday_date + 'T12:00:00'), 'dd/MM/yyyy')}
                {h.is_recurring && ' · Anual'}
              </span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteHoliday.mutate(h.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            type="date" value={newHoliday.holiday_date}
            onChange={e => setNewHoliday(p => ({ ...p, holiday_date: e.target.value }))}
            className="w-40"
          />
          <Input
            placeholder="Nome do feriado" value={newHoliday.name}
            onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
          />
          <Button size="sm" onClick={async () => {
            if (!newHoliday.holiday_date || !newHoliday.name) return
            await createHoliday.mutateAsync(newHoliday)
            setNewHoliday({ holiday_date: '', name: '', is_recurring: false })
          }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Google Calendar Tab ───────────────────────────────────────────────────────

function GoogleCalendarTab() {
  const { data: connection, isLoading } = useGoogleCalendarConnection()
  const { data: events = [] } = useCalendarEvents(format(new Date(), 'yyyy-MM'))
  const initiateAuth = useInitiateGoogleAuth()
  const sync = useSyncGoogleCalendar()
  const disconnect = useDisconnectGoogleCalendar()
  const [searchParams, setSearchParams] = useSearchParams()
  const [toast, setToast] = useState<'connected' | 'error' | 'disconnected' | null>(null)

  useEffect(() => {
    const connected = searchParams.get('google_connected')
    const error = searchParams.get('google_error')
    if (connected === '1') {
      setToast('connected')
      sync.mutate()
      setSearchParams(p => { p.delete('google_connected'); return p }, { replace: true })
    } else if (error === '1') {
      setToast('error')
      setSearchParams(p => { p.delete('google_error'); return p }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    try {
      const result = await initiateAuth.mutateAsync()
      // Same-tab redirect — user returns to /admin/calendar?google_connected=1
      window.location.href = result.auth_url
    } catch {
      setToast('error')
    }
  }

  const handleDisconnect = async () => {
    await disconnect.mutateAsync()
    setToast('disconnected')
  }

  const googleEvents = events.filter(e => e.source === 'google')
  const bookingEvents = events.filter(e => e.source === 'booking')

  return (
    <div className="space-y-4">
      {/* Toast messages */}
      {toast === 'connected' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>Google Calendar conectado com sucesso! Sincronizando eventos...</span>
          <button onClick={() => setToast(null)} className="ml-auto flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {toast === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Erro ao conectar. Verifique as variáveis <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> no Supabase.</span>
          <button onClick={() => setToast(null)} className="ml-auto flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {toast === 'disconnected' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-sm">
          <span>Google Calendar desconectado.</span>
          <button onClick={() => setToast(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Verificando conexão...</p>}

      {!isLoading && (
        <div className="rounded-lg border border-border">
          {connection?.is_active ? (
            /* ── Connected state ── */
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success inline-block" />
                    {connection.google_email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {connection.last_synced_at
                      ? `Última sync: ${format(parseISO(connection.last_synced_at), "dd/MM 'às' HH:mm")}`
                      : 'Nunca sincronizado'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => sync.mutate()}
                    disabled={sync.isPending}
                  >
                    <RefreshCw className={cn('h-4 w-4 mr-1', sync.isPending && 'animate-spin')} />
                    Sincronizar
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={handleDisconnect}
                    disabled={disconnect.isPending}
                  >
                    Desconectar
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-blue-500/10 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-blue-600">{googleEvents.length}</p>
                  <p className="text-[11px] text-muted-foreground">Do Google</p>
                </div>
                <div className="rounded-lg bg-primary/10 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-primary">{bookingEvents.length}</p>
                  <p className="text-[11px] text-muted-foreground">Agendamentos</p>
                </div>
              </div>

              {/* Events list */}
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {events.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhum evento este mês. Clique em Sincronizar.
                  </p>
                )}
                {events.map(e => (
                  <div key={e.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                    <span className="text-muted-foreground w-24 flex-shrink-0">
                      {format(parseISO(e.start_at), 'dd/MM HH:mm')}
                    </span>
                    <span className="truncate flex-1">{e.title}</span>
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px]',
                        e.source === 'booking' && 'bg-primary/10 text-primary border-0',
                        e.source === 'google' && 'bg-blue-500/10 text-blue-600 border-0',
                      )}
                    >
                      {e.source === 'booking' ? 'Booking' : 'Google'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Not connected state ── */
            <div className="p-4 space-y-4">
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <LogIn className="h-7 w-7 opacity-40" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Conectar Google Calendar</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Sincronize seus eventos, evite conflitos e crie agendamentos diretamente no seu calendário.
                  </p>
                </div>
                <Button onClick={handleConnect} disabled={initiateAuth.isPending} className="gap-2 min-w-[200px]">
                  {initiateAuth.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  {initiateAuth.isPending ? 'Redirecionando...' : 'Conectar com Google'}
                </Button>
              </div>

              {/* Setup instructions */}
              <div className="border border-dashed border-border rounded-lg p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  Pré-requisitos para conectar
                </p>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Acesse o <strong>Google Cloud Console</strong> → Credenciais → Criar cliente OAuth 2.0</li>
                  <li>
                    Ative a <strong>Google Calendar API</strong> no projeto
                  </li>
                  <li>
                    Adicione a URI de redirecionamento autorizado:
                    <div className="mt-1 font-mono bg-background rounded px-2 py-1.5 text-[10px] break-all select-all">
                      {`${import.meta.env.VITE_SUPABASE_URL ?? '[SUPABASE_URL]'}/functions/v1/google-calendar-callback`}
                    </div>
                  </li>
                  <li>
                    Configure no Supabase → Edge Functions → Secrets:
                    <div className="mt-1 font-mono bg-background rounded px-2 py-1.5 text-[10px] space-y-0.5">
                      <p>GOOGLE_CLIENT_ID = ...</p>
                      <p>GOOGLE_CLIENT_SECRET = ...</p>
                      <p>APP_URL = {window.location.origin}</p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const [searchParams] = useSearchParams()

  // Auto-switch to Google tab on OAuth callback
  const initialTab = (searchParams.get('google_connected') || searchParams.get('google_error'))
    ? 'google'
    : 'calendar'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display">Calendário & Agendamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie tipos de evento, horários, agendamentos e integrações de calendário.
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="bookings">Agendamentos</TabsTrigger>
          <TabsTrigger value="links">Links de Agendamento</TabsTrigger>
          <TabsTrigger value="event-types">Tipos de Evento</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="google">Google Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <CalendarViewTab />
        </TabsContent>
        <TabsContent value="bookings" className="mt-4">
          <BookingsTab />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <BookingLinksTab />
        </TabsContent>
        <TabsContent value="event-types" className="mt-4">
          <EventTypesTab />
        </TabsContent>
        <TabsContent value="hours" className="mt-4">
          <BusinessHoursTab />
        </TabsContent>
        <TabsContent value="google" className="mt-4">
          <GoogleCalendarTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

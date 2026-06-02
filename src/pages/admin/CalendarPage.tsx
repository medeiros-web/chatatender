import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, Edit2, Trash2, Copy, ExternalLink, Calendar,
  Clock, MapPin, Link2, Check, X, RefreshCw, Settings,
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
} from '@/hooks/useBooking'
import type { BookingEventType, BookingRequest, BusinessHour } from '@/hooks/useBooking'

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
              <Input type="number" {...register('duration_minutes')} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Buffer antes</label>
              <Input type="number" {...register('buffer_before_minutes')} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Buffer depois</label>
              <Input type="number" {...register('buffer_after_minutes')} />
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
            <Switch
              checked={isActive}
              onCheckedChange={v => setValue('is_active', v)}
            />
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

// ── Event Types Tab ───────────────────────────────────────────────────────────

function EventTypesTab() {
  const { data: eventTypes = [], isLoading } = useBookingEventTypes()
  const deleteET = useDeleteBookingEventType()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BookingEventType | null>(null)

  const baseUrl = window.location.origin

  const copyLink = (slug: string) =>
    navigator.clipboard.writeText(`${baseUrl}/booking/${slug}`)

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
            <div
              className="w-3 h-10 rounded-full flex-shrink-0"
              style={{ backgroundColor: et.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{et.name}</span>
                {!et.is_active && (
                  <Badge variant="secondary" className="text-xs">Inativo</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {et.duration_minutes} min
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
                size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => copyLink(et.slug)}
                title="Copiar link"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => window.open(`/booking/${et.slug}`, '_blank')}
                title="Abrir página"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => { setEditing(et); setDialogOpen(true) }}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => deleteET.mutate(et.id)}
              >
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

      <EventTypeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />
    </div>
  )
}

// ── Bookings Tab ──────────────────────────────────────────────────────────────

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

function BookingsTab() {
  const { data: bookings = [], isLoading } = useBookingRequests()
  const updateStatus = useUpdateBookingStatus()

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {bookings.map(b => (
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
            <div className="text-right text-xs text-muted-foreground">
              {format(parseISO(b.requested_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>

          {b.booking_event_types && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: (b.booking_event_types as any).color }}
              />
              {(b.booking_event_types as any).name} — {(b.booking_event_types as any).duration_minutes} min
            </div>
          )}

          {b.notes && <p className="text-xs bg-muted rounded px-2 py-1">{b.notes}</p>}

          {b.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline" className="h-7 text-xs gap-1 text-success border-success/30"
                onClick={() => updateStatus.mutate({ id: b.id, status: 'confirmed' })}
              >
                <Check className="h-3 w-3" /> Confirmar
              </Button>
              <Button
                size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                onClick={() => updateStatus.mutate({ id: b.id, status: 'cancelled' })}
              >
                <X className="h-3 w-3" /> Cancelar
              </Button>
            </div>
          )}
        </div>
      ))}

      {!isLoading && bookings.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum agendamento ainda.</p>
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

  // Sync from server
  if (hours.length > 0 && localHours.length === 0) {
    setLocalHours(hours)
  }

  const updateHour = (idx: number, field: keyof BusinessHour, value: any) => {
    setLocalHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  return (
    <div className="space-y-6">
      {/* Business Hours */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Horário de atendimento</h3>
        {localHours.map((h, i) => (
          <div key={h.day_of_week} className="flex items-center gap-3">
            <span className="w-8 text-sm font-medium">{DAY_NAMES[h.day_of_week]}</span>
            <Switch
              checked={h.is_open}
              onCheckedChange={v => updateHour(i, 'is_open', v)}
            />
            {h.is_open && (
              <>
                <Input
                  type="time"
                  value={h.start_time}
                  onChange={e => updateHour(i, 'start_time', e.target.value)}
                  className="w-32"
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="time"
                  value={h.end_time}
                  onChange={e => updateHour(i, 'end_time', e.target.value)}
                  className="w-32"
                />
              </>
            )}
            {!h.is_open && (
              <span className="text-xs text-muted-foreground">Fechado</span>
            )}
          </div>
        ))}
        <Button
          size="sm"
          onClick={() => saveHours.mutate(localHours as any)}
          disabled={saveHours.isPending}
        >
          {saveHours.isPending ? 'Salvando...' : 'Salvar horários'}
        </Button>
      </div>

      {/* Holidays */}
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
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-destructive"
              onClick={() => deleteHoliday.mutate(h.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            type="date"
            value={newHoliday.holiday_date}
            onChange={e => setNewHoliday(p => ({ ...p, holiday_date: e.target.value }))}
            className="w-40"
          />
          <Input
            placeholder="Nome do feriado"
            value={newHoliday.name}
            onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
          />
          <Button
            size="sm"
            onClick={async () => {
              if (!newHoliday.holiday_date || !newHoliday.name) return
              await createHoliday.mutateAsync(newHoliday)
              setNewHoliday({ holiday_date: '', name: '', is_recurring: false })
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Google Calendar Tab ───────────────────────────────────────────────────────

function GoogleCalendarTab() {
  const { data: connection } = useGoogleCalendarConnection()
  const { data: events = [] } = useCalendarEvents(format(new Date(), 'yyyy-MM'))
  const initiateAuth = useInitiateGoogleAuth()
  const sync = useSyncGoogleCalendar()

  const handleConnect = async () => {
    const result = await initiateAuth.mutateAsync()
    window.open(result.auth_url, '_blank', 'width=600,height=700')
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-border">
        {connection?.is_active ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  Conectado: {connection.google_email}
                </p>
                {connection.last_synced_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Última sync: {format(parseISO(connection.last_synced_at), "dd/MM HH:mm")}
                  </p>
                )}
              </div>
              <Button
                size="sm" variant="outline" onClick={() => sync.mutate()}
                disabled={sync.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${sync.isPending ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {events.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                  <span className="text-muted-foreground w-28 flex-shrink-0">
                    {format(parseISO(e.start_at), 'dd/MM HH:mm')}
                  </span>
                  <span className="truncate">{e.title}</span>
                  {e.source === 'booking' && (
                    <Badge variant="secondary" className="text-[10px]">Booking</Badge>
                  )}
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum evento este mês.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3 py-4">
            <Calendar className="h-8 w-8 mx-auto opacity-30" />
            <p className="text-sm text-muted-foreground">
              Conecte o Google Calendar para sincronizar eventos e evitar conflitos.
            </p>
            <Button onClick={handleConnect} disabled={initiateAuth.isPending}>
              {initiateAuth.isPending ? 'Aguarde...' : 'Conectar Google Calendar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CalendarPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-display">Calendário & Agendamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie tipos de evento, horários disponíveis e integrações de calendário.
        </p>
      </div>

      <Tabs defaultValue="event-types">
        <TabsList>
          <TabsTrigger value="event-types">Tipos de Evento</TabsTrigger>
          <TabsTrigger value="bookings">Agendamentos</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="google">Google Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="event-types" className="mt-4">
          <EventTypesTab />
        </TabsContent>
        <TabsContent value="bookings" className="mt-4">
          <BookingsTab />
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

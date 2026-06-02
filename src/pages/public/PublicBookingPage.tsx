import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday, isPast, parseISO,
  startOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock, MapPin, Check, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  useBookingEventTypeBySlug, useAvailableSlots, createBookingRequest,
  useBusinessHours,
} from '@/hooks/useBooking'
import type { TimeSlot } from '@/hooks/useBooking'

// ── Schema ────────────────────────────────────────────────────────────────────

const bookingSchema = z.object({
  requester_name: z.string().min(2, 'Nome obrigatório'),
  requester_email: z.string().email('E-mail inválido'),
  requester_phone: z.string().optional(),
  notes: z.string().optional(),
})

type BookingForm = z.infer<typeof bookingSchema>

// ── Calendar UI ───────────────────────────────────────────────────────────────

function MonthCalendar({
  month, selectedDate, onSelectDate, orgId, eventTypeId,
}: {
  month: Date
  selectedDate: Date | null
  onSelectDate: (d: Date) => void
  orgId: string
  eventTypeId: string
}) {
  const { data: hours = [] } = useBusinessHours(orgId)

  const openDays = new Set(
    hours.filter(h => h.is_open).map(h => h.day_of_week)
  )

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  })

  // Pad with empty cells for alignment
  const firstDow = startOfMonth(month).getDay()
  const padded = [...Array(firstDow).fill(null), ...days]

  const today = startOfDay(new Date())

  const isSelectable = (d: Date) =>
    !isPast(startOfDay(d)) && openDays.has(d.getDay())

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(n => (
          <div key={n} className="text-center text-xs font-medium text-muted-foreground py-1">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {padded.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />
          const selectable = isSelectable(d)
          const isSelected = selectedDate ? isSameDay(d, selectedDate) : false
          const isTodayDay = isToday(d)

          return (
            <button
              key={d.toISOString()}
              disabled={!selectable}
              onClick={() => selectable && onSelectDate(d)}
              className={cn(
                'aspect-square flex items-center justify-center text-sm rounded-lg transition-colors',
                !selectable && 'text-muted-foreground/40 cursor-not-allowed',
                selectable && !isSelected && 'hover:bg-primary/10 cursor-pointer',
                isSelected && 'bg-primary text-primary-foreground font-semibold',
                isTodayDay && !isSelected && 'border border-primary text-primary font-medium',
              )}
            >
              {format(d, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Time Slot Grid ────────────────────────────────────────────────────────────

function TimeSlotGrid({
  slots, selected, onSelect,
}: {
  slots: TimeSlot[]
  selected: string | null
  onSelect: (s: TimeSlot) => void
}) {
  const available = slots.filter(s => s.available)

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Sem horários disponíveis para este dia.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
      {available.map(slot => {
        const isSelected = selected === slot.start
        return (
          <button
            key={slot.start}
            onClick={() => onSelect(slot)}
            className={cn(
              'py-2 px-3 rounded-lg border text-sm font-medium transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-primary hover:bg-primary/5',
            )}
          >
            {format(parseISO(slot.start), 'HH:mm')}
          </button>
        )
      })}
    </div>
  )
}

// ── Booking Form ──────────────────────────────────────────────────────────────

function BookingFormStep({
  slot, eventTypeName, onBack, orgId, eventTypeId,
}: {
  slot: TimeSlot
  eventTypeName: string
  onBack: () => void
  orgId: string
  eventTypeId: string
}) {
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
  })

  const onSubmit = async (values: BookingForm) => {
    await createBookingRequest({
      organization_id: orgId,
      event_type_id: eventTypeId,
      requester_name: values.requester_name,
      requester_email: values.requester_email,
      requester_phone: values.requester_phone,
      requested_at: slot.start,
      notes: values.notes,
    })
    setDone(true)
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-xl font-semibold font-display">Agendado com sucesso!</h2>
        <p className="text-muted-foreground text-sm">
          Você receberá uma confirmação por e-mail em breve.
        </p>
        <p className="font-medium">
          {format(parseISO(slot.start), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="p-3 rounded-lg bg-primary/10 text-sm">
        <p className="font-medium">{eventTypeName}</p>
        <p className="text-muted-foreground mt-0.5">
          {format(parseISO(slot.start), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nome *</label>
          <Input {...register('requester_name')} placeholder="Seu nome" />
          {errors.requester_name && (
            <p className="text-xs text-destructive">{errors.requester_name.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">E-mail *</label>
          <Input type="email" {...register('requester_email')} placeholder="seu@email.com" />
          {errors.requester_email && (
            <p className="text-xs text-destructive">{errors.requester_email.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">WhatsApp</label>
          <Input {...register('requester_phone')} placeholder="(11) 99999-9999" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Observações</label>
          <Textarea {...register('notes')} rows={2} placeholder="Alguma informação adicional?" />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Confirmando...' : 'Confirmar agendamento'}
        </Button>
      </form>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: eventType, isLoading, isError } = useBookingEventTypeBySlug(slug)

  const [month, setMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined

  const { data: slots = [], isFetching: slotsLoading } = useAvailableSlots({
    orgId: eventType?.organization_id,
    eventTypeId: eventType?.id,
    date: dateStr,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (isError || !eventType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Calendar className="h-10 w-10 mx-auto opacity-30" />
          <p className="font-medium">Evento não encontrado</p>
          <p className="text-sm text-muted-foreground">
            Este link de agendamento não existe ou foi desativado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-3xl bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border" style={{ borderLeftColor: eventType.color, borderLeftWidth: 4 }}>
          <h1 className="text-xl font-bold font-display">{eventType.name}</h1>
          {eventType.description && (
            <p className="text-sm text-muted-foreground mt-1">{eventType.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {eventType.duration_minutes} min
            </span>
            {eventType.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {eventType.location}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {selectedSlot ? (
            <BookingFormStep
              slot={selectedSlot}
              eventTypeName={eventType.name}
              onBack={() => setSelectedSlot(null)}
              orgId={eventType.organization_id}
              eventTypeId={eventType.id}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calendar */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setMonth(m => subMonths(m, 1))}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-semibold capitalize">
                    {format(month, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <button
                    onClick={() => setMonth(m => addMonths(m, 1))}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <MonthCalendar
                  month={month}
                  selectedDate={selectedDate}
                  onSelectDate={d => { setSelectedDate(d); setSelectedSlot(null) }}
                  orgId={eventType.organization_id}
                  eventTypeId={eventType.id}
                />
              </div>

              {/* Time slots */}
              <div>
                {!selectedDate ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Clock className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Selecione um dia para ver os horários</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold mb-3 capitalize">
                      {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    {slotsLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando horários...</p>
                    ) : (
                      <TimeSlotGrid
                        slots={slots}
                        selected={null}
                        onSelect={setSelectedSlot}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedSlot && selectedDate && slots.filter(s => s.available).length > 0 && (
            <div className="mt-4 flex justify-end">
              <Button
                disabled={!selectedSlot}
                onClick={() => {/* slot selection triggers next step */}}
              >
                Continuar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

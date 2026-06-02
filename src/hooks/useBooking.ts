import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// ── Types ────────────────────────────────────────────────────────────────────

export interface BookingEventType {
  id: string
  organization_id: string
  created_by: string | null
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  location: string | null
  color: string
  max_bookings_per_slot: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BusinessHour {
  id: string
  organization_id: string
  day_of_week: number // 0=Sun..6=Sat
  start_time: string  // 'HH:MM'
  end_time: string
  is_open: boolean
}

export interface BusinessHoliday {
  id: string
  organization_id: string
  holiday_date: string
  name: string
  is_recurring: boolean
}

export interface AvailabilityOverride {
  id: string
  organization_id: string
  override_date: string
  start_time: string | null
  end_time: string | null
  is_available: boolean
  reason: string | null
}

export interface CalendarEvent {
  id: string
  organization_id: string
  user_id: string | null
  external_id: string | null
  title: string
  description: string | null
  start_at: string
  end_at: string
  location: string | null
  is_busy: boolean
  source: 'manual' | 'google' | 'booking'
  booking_request_id: string | null
  created_at: string
}

export interface BookingRequest {
  id: string
  organization_id: string
  event_type_id: string
  calendar_event_id: string | null
  lead_id: string | null
  requester_name: string
  requester_email: string
  requester_phone: string | null
  requested_at: string
  timezone: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show'
  notes: string | null
  cancellation_reason: string | null
  confirmation_sent_at: string | null
  created_at: string
  updated_at: string
  booking_event_types?: BookingEventType
}

export interface GoogleCalendarConnection {
  id: string
  organization_id: string
  user_id: string
  google_email: string
  calendar_id: string
  is_active: boolean
  last_synced_at: string | null
  created_at: string
}

// Slot returned by availability computation
export interface TimeSlot {
  start: string // ISO
  end: string   // ISO
  available: boolean
}

// ── Event Types ───────────────────────────────────────────────────────────────

export function useBookingEventTypes() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['booking_event_types', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('booking_event_types')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as BookingEventType[]
    },
  })
}

export function useBookingEventTypeBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['booking_event_type_slug', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('booking_event_types')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()
      if (error) throw error
      return data as BookingEventType
    },
  })
}

export function useCreateBookingEventType() {
  const { organizationId, user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<BookingEventType>) => {
      const { data, error } = await (supabase as any)
        .from('booking_event_types')
        .insert({ ...values, organization_id: organizationId, created_by: user?.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking_event_types'] }),
  })
}

export function useUpdateBookingEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<BookingEventType> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('booking_event_types')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking_event_types'] }),
  })
}

export function useDeleteBookingEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('booking_event_types')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking_event_types'] }),
  })
}

// ── Business Hours ────────────────────────────────────────────────────────────

export function useBusinessHours(orgId?: string) {
  const { organizationId } = useAuth()
  const id = orgId ?? organizationId
  return useQuery({
    queryKey: ['business_hours', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_hours')
        .select('*')
        .eq('organization_id', id)
        .order('day_of_week')
      if (error) throw error
      return data as BusinessHour[]
    },
  })
}

export function useSaveBusinessHours() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (hours: Omit<BusinessHour, 'id'>[]) => {
      // Upsert all 7 days
      const rows = hours.map(h => ({ ...h, organization_id: organizationId }))
      const { error } = await (supabase as any)
        .from('business_hours')
        .upsert(rows, { onConflict: 'organization_id,day_of_week' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business_hours'] }),
  })
}

// ── Holidays ─────────────────────────────────────────────────────────────────

export function useBusinessHolidays() {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['business_holidays', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_holidays')
        .select('*')
        .eq('organization_id', organizationId)
        .order('holiday_date')
      if (error) throw error
      return data as BusinessHoliday[]
    },
  })
}

export function useCreateHoliday() {
  const { organizationId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<BusinessHoliday, 'id' | 'organization_id'>) => {
      const { error } = await (supabase as any)
        .from('business_holidays')
        .insert({ ...values, organization_id: organizationId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business_holidays'] }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('business_holidays')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business_holidays'] }),
  })
}

// ── Booking Requests ──────────────────────────────────────────────────────────

export function useBookingRequests(eventTypeId?: string) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['booking_requests', organizationId, eventTypeId],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('booking_requests')
        .select('*, booking_event_types(name, slug, color, duration_minutes)')
        .eq('organization_id', organizationId)
        .order('requested_at', { ascending: false })
      if (eventTypeId) q = q.eq('event_type_id', eventTypeId)
      const { data, error } = await q
      if (error) throw error
      return data as BookingRequest[]
    },
  })
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, cancellation_reason }: {
      id: string
      status: BookingRequest['status']
      cancellation_reason?: string
    }) => {
      const { error } = await (supabase as any)
        .from('booking_requests')
        .update({ status, ...(cancellation_reason ? { cancellation_reason } : {}) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking_requests'] }),
  })
}

// ── Public booking: compute available slots ───────────────────────────────────

export function useAvailableSlots(params: {
  orgId: string | undefined
  eventTypeId: string | undefined
  date: string | undefined  // YYYY-MM-DD
}) {
  return useQuery<TimeSlot[]>({
    queryKey: ['available_slots', params.orgId, params.eventTypeId, params.date],
    enabled: !!params.orgId && !!params.eventTypeId && !!params.date,
    queryFn: async () => {
      const { orgId, eventTypeId, date } = params

      // 1. Get event type
      const { data: et, error: e1 } = await (supabase as any)
        .from('booking_event_types')
        .select('*')
        .eq('id', eventTypeId)
        .single()
      if (e1 || !et) return []

      // 2. Get business hours for that day of week
      const dow = new Date(date + 'T12:00:00').getDay()
      const { data: bh } = await (supabase as any)
        .from('business_hours')
        .select('*')
        .eq('organization_id', orgId)
        .eq('day_of_week', dow)
        .single()

      // 3. Check holidays
      const { data: holiday } = await (supabase as any)
        .from('business_holidays')
        .select('id')
        .eq('organization_id', orgId)
        .eq('holiday_date', date)
        .maybeSingle()

      if (holiday || !bh?.is_open) return []

      // 4. Check overrides
      const { data: override } = await (supabase as any)
        .from('availability_overrides')
        .select('*')
        .eq('organization_id', orgId)
        .eq('override_date', date)
        .maybeSingle()

      let startTime = bh.start_time as string
      let endTime   = bh.end_time as string
      if (override) {
        if (!override.is_available) return []
        if (override.start_time) startTime = override.start_time
        if (override.end_time)   endTime   = override.end_time
      }

      // 5. Existing bookings for that day
      const dayStart = `${date}T00:00:00`
      const dayEnd   = `${date}T23:59:59`
      const { data: existing } = await (supabase as any)
        .from('booking_requests')
        .select('requested_at')
        .eq('organization_id', orgId)
        .eq('event_type_id', eventTypeId)
        .in('status', ['pending', 'confirmed'])
        .gte('requested_at', dayStart)
        .lte('requested_at', dayEnd)

      const bookedTimes = new Set((existing ?? []).map((b: any) =>
        new Date(b.requested_at).toISOString()
      ))

      // 6. Build slots
      const slots: TimeSlot[] = []
      const duration = et.duration_minutes
      const bufferAfter = et.buffer_after_minutes ?? 0
      const step = duration + bufferAfter

      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      const startMin = sh * 60 + sm
      const endMin   = eh * 60 + em

      const now = new Date()
      const today = now.toISOString().slice(0, 10)

      for (let m = startMin; m + duration <= endMin; m += step) {
        const h = Math.floor(m / 60)
        const min = m % 60
        const slotStart = new Date(`${date}T${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`)
        const slotEnd   = new Date(slotStart.getTime() + duration * 60000)

        // Skip past slots
        if (date === today && slotStart <= now) continue

        const startISO = slotStart.toISOString()
        const available = !bookedTimes.has(startISO)
        slots.push({ start: startISO, end: slotEnd.toISOString(), available })
      }

      return slots
    },
  })
}

// ── Create booking (public) ───────────────────────────────────────────────────

export async function createBookingRequest(data: {
  organization_id: string
  event_type_id: string
  requester_name: string
  requester_email: string
  requester_phone?: string
  requested_at: string
  timezone?: string
  notes?: string
}) {
  const { data: result, error } = await (supabase as any)
    .from('booking_requests')
    .insert({
      ...data,
      timezone: data.timezone ?? 'America/Sao_Paulo',
      status: 'confirmed',
    })
    .select()
    .single()
  if (error) throw error
  return result as BookingRequest
}

// ── Google Calendar ───────────────────────────────────────────────────────────

export function useGoogleCalendarConnection() {
  const { organizationId, user } = useAuth()
  return useQuery({
    queryKey: ['google_calendar_connection', organizationId, user?.id],
    enabled: !!organizationId && !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('google_calendar_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', user!.id)
        .maybeSingle()
      return data as GoogleCalendarConnection | null
    },
  })
}

export function useCalendarEvents(month?: string) {
  const { organizationId } = useAuth()
  return useQuery({
    queryKey: ['calendar_events', organizationId, month],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('calendar_events')
        .select('*')
        .eq('organization_id', organizationId)
        .order('start_at')
      if (month) {
        const [y, m] = month.split('-').map(Number)
        const from = new Date(y, m - 1, 1).toISOString()
        const to   = new Date(y, m, 0, 23, 59, 59).toISOString()
        q = q.gte('start_at', from).lte('start_at', to)
      }
      const { data, error } = await q
      if (error) throw error
      return data as CalendarEvent[]
    },
  })
}

export function useInitiateGoogleAuth() {
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao iniciar OAuth')
      return json as { auth_url: string }
    },
  })
}

export function useSyncGoogleCalendar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao sincronizar')
      return json
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar_events'] }),
  })
}

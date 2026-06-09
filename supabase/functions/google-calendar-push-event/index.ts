import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshAccessToken(
  supabase: any,
  conn: any,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tokens = await res.json()
  if (tokens.error) throw new Error(tokens.error_description ?? tokens.error)

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()
  await supabase
    .from('google_calendar_connections')
    .update({ access_token: tokens.access_token, token_expires_at: expiresAt })
    .eq('id', conn.id)

  return tokens.access_token as string
}

// Map hex color to Google Calendar colorId (1-11)
function hexToGoogleColorId(hex: string): string {
  const map: Record<string, string> = {
    '#ef4444': '11', '#dc2626': '11', // red
    '#f97316': '6',  '#ea580c': '6',  // tangerine
    '#eab308': '5',  '#ca8a04': '5',  // banana
    '#22c55e': '2',  '#16a34a': '2',  // sage
    '#3b82f6': '9',  '#2563eb': '9',  // blueberry
    '#6366f1': '9',  '#4f46e5': '9',  // blueberry (indigo)
    '#8b5cf6': '3',  '#7c3aed': '3',  // grape
    '#ec4899': '4',  '#db2777': '4',  // flamingo
  }
  return map[hex.toLowerCase()] ?? '9'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Auth
    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { booking_request_id } = await req.json()
    if (!booking_request_id) return json({ error: 'booking_request_id obrigatório' }, 400)

    // Load booking + event type
    const { data: booking, error: bookingErr } = await supabase
      .from('booking_requests')
      .select('*, booking_event_types(*)')
      .eq('id', booking_request_id)
      .single()
    if (bookingErr || !booking) return json({ error: 'Agendamento não encontrado' }, 404)

    if (booking.calendar_event_id) {
      return json({ error: 'Evento já criado no Google Calendar', skipped: true }, 200)
    }

    // Load active Google Calendar connection for this org
    const { data: conn } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('organization_id', booking.organization_id)
      .eq('is_active', true)
      .maybeSingle()
    if (!conn) return json({ error: 'Nenhuma conexão Google Calendar ativa para esta organização' }, 400)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

    let accessToken: string = conn.access_token
    if (new Date(conn.token_expires_at) <= new Date()) {
      accessToken = await refreshAccessToken(supabase, conn, clientId, clientSecret)
    }

    const et = booking.booking_event_types as any
    const startAt = new Date(booking.requested_at)
    const endAt = new Date(startAt.getTime() + et.duration_minutes * 60000)
    const tz = booking.timezone ?? 'America/Sao_Paulo'

    const descLines = [
      `Agendamento via ChatAtender`,
      ``,
      `Nome: ${booking.requester_name}`,
      `E-mail: ${booking.requester_email}`,
      booking.requester_phone ? `Telefone: ${booking.requester_phone}` : null,
      booking.notes ? `\nObservações: ${booking.notes}` : null,
    ].filter(Boolean).join('\n')

    // Create event in Google Calendar
    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `${et.name} — ${booking.requester_name}`,
          description: descLines,
          location: et.location ?? undefined,
          colorId: hexToGoogleColorId(et.color ?? '#6366f1'),
          start: { dateTime: startAt.toISOString(), timeZone: tz },
          end:   { dateTime: endAt.toISOString(),   timeZone: tz },
          attendees: [
            { email: booking.requester_email, displayName: booking.requester_name },
          ],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email',  minutes: 1440 }, // 24h before
              { method: 'popup',  minutes: 30 },
            ],
          },
        }),
      },
    )
    const gcalEvent = await gcalRes.json()
    if (gcalEvent.error) throw new Error(gcalEvent.error.message ?? JSON.stringify(gcalEvent.error))

    // Upsert into calendar_events table
    const { data: calEvent } = await supabase
      .from('calendar_events')
      .upsert({
        organization_id: booking.organization_id,
        user_id: user.id,
        external_id: gcalEvent.id,
        title: gcalEvent.summary,
        description: gcalEvent.description ?? null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        location: et.location ?? null,
        is_busy: true,
        source: 'booking',
        booking_request_id: booking.id,
      }, { onConflict: 'organization_id,external_id' })
      .select('id')
      .single()

    // Update booking with calendar_event_id
    if (calEvent) {
      await supabase
        .from('booking_requests')
        .update({ calendar_event_id: calEvent.id })
        .eq('id', booking.id)
    }

    return json({
      success: true,
      google_event_id: gcalEvent.id,
      event_link: gcalEvent.htmlLink,
      calendar_event_id: calEvent?.id,
    })
  } catch (err: any) {
    console.error('google-calendar-push-event error:', err)
    return json({ error: err?.message ?? String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

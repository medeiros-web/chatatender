import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshToken(
  supabase: any,
  conn: any,
  clientId: string,
  clientSecret: string
) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  const tokens = await res.json()
  if (tokens.error) throw new Error(tokens.error)

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()
  await supabase
    .from('google_calendar_connections')
    .update({ access_token: tokens.access_token, token_expires_at: expiresAt })
    .eq('id', conn.id)

  return tokens.access_token as string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization') ?? ''
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const { data: orgId } = await supabase.rpc('get_user_organization', { p_user_id: user.id })

    const { data: conn } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!conn) return new Response(JSON.stringify({ error: 'No Google connection' }), { status: 400, headers: CORS })

    const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

    let accessToken = conn.access_token
    if (new Date(conn.token_expires_at) <= new Date()) {
      accessToken = await refreshToken(supabase, conn, clientId, clientSecret)
    }

    // Fetch next 30 days of events
    const now      = new Date()
    const timeMin  = now.toISOString()
    const timeMax  = new Date(now.getTime() + 30 * 24 * 3600000).toISOString()

    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events?` +
      new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', maxResults: '250' }),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const gcal = await gcalRes.json()
    if (gcal.error) throw new Error(gcal.error.message)

    const events = (gcal.items ?? []).map((e: any) => ({
      organization_id: orgId,
      user_id: user.id,
      external_id: e.id,
      title: e.summary ?? 'Sem título',
      description: e.description ?? null,
      start_at: e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`,
      end_at:   e.end?.dateTime   ?? `${e.end?.date}T00:00:00Z`,
      location: e.location ?? null,
      is_busy: (e.transparency ?? 'opaque') !== 'transparent',
      source: 'google',
    }))

    if (events.length > 0) {
      await supabase
        .from('calendar_events')
        .upsert(events, { onConflict: 'organization_id,external_id', ignoreDuplicates: false })
    }

    // Update last_synced_at
    await supabase
      .from('google_calendar_connections')
      .update({ last_synced_at: now.toISOString() })
      .eq('id', conn.id)

    return new Response(JSON.stringify({ synced: events.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: CORS,
    })
  }
})

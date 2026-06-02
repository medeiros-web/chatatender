import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/admin/calendar?google_error=1`)
  }

  try {
    const { user_id } = JSON.parse(atob(state))

    const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
    const redirectUri  = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (tokens.error) throw new Error(tokens.error_description ?? tokens.error)

    // Get user email
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get org from user
    const { data: orgData } = await supabase.rpc('get_user_organization', { p_user_id: user_id })

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    await supabase
      .from('google_calendar_connections')
      .upsert({
        organization_id: orgData,
        user_id,
        google_email:  profile.email,
        calendar_id:   'primary',
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
      }, { onConflict: 'organization_id,user_id' })

    return Response.redirect(`${appUrl}/admin/calendar?google_connected=1`)
  } catch (err) {
    console.error('Google callback error:', err)
    return Response.redirect(`${appUrl}/admin/calendar?google_error=1`)
  }
})

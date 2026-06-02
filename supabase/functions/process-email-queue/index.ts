import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EmailRow {
  id: string
  to_email: string
  to_name: string | null
  subject: string
  html_body: string
  variables: Record<string, string>
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fetch queued emails ready to process
  const { data: emails, error: fetchErr } = await supabase
    .from('email_send_log')
    .select('id, to_email, to_name, subject, html_body, variables')
    .eq('status', 'queued')
    .lte('process_after', new Date().toISOString())
    .limit(50)

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 })
  }

  const queue = (emails ?? []) as EmailRow[]
  if (queue.length === 0) {
    return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0 }), { status: 200 })
  }

  // Fetch Resend credentials from platform_settings
  const { data: rows } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['resend_api_key', 'email_from', 'email_from_name'])

  const cfg: Record<string, string> = {}
  for (const r of (rows ?? [])) cfg[r.key] = r.value ?? ''

  const apiKey   = cfg['resend_api_key']
  const from     = cfg['email_from'] || 'noreply@chatatender.com'
  const fromName = cfg['email_from_name'] || 'ChatAtender'

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'resend_api_key not configured in platform_settings' }),
      { status: 500 },
    )
  }

  let sent = 0
  let failed = 0

  for (const email of queue) {
    let subject  = email.subject
    let htmlBody = email.html_body
    const vars   = email.variables ?? {}

    // Replace {{variable}} placeholders
    for (const [k, v] of Object.entries(vars)) {
      const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g')
      subject  = subject.replace(re, String(v))
      htmlBody = htmlBody.replace(re, String(v))
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${from}>`,
          to: email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email,
          subject,
          html: htmlBody,
        }),
      })

      if (res.ok) {
        const body = await res.json() as { id?: string }
        await supabase.from('email_send_log').update({
          status: 'sent',
          resend_id: body.id ?? null,
          sent_at: new Date().toISOString(),
        }).eq('id', email.id)
        sent++
      } else {
        const errText = await res.text()
        await supabase.from('email_send_log').update({
          status: 'failed',
          error_message: errText,
        }).eq('id', email.id)
        failed++
      }
    } catch (e) {
      await supabase.from('email_send_log').update({
        status: 'failed',
        error_message: String(e),
      }).eq('id', email.id)
      failed++
    }
  }

  return new Response(
    JSON.stringify({ processed: queue.length, sent, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

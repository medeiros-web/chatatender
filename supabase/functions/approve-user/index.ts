import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_URL = 'https://chatatender.vercel.app'

serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return html('<p>Token inválido.</p>', 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Buscar token
  const { data: record, error } = await supabase
    .from('user_approval_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error || !record) return html('<p>Token não encontrado.</p>', 404)
  if (record.used_at)   return html('<p>Este link já foi utilizado.</p>', 400)
  if (new Date(record.expires_at) < new Date()) return html('<p>Link expirado. Acesse o painel para gerenciar usuários.</p>', 400)

  const action: 'approve' | 'reject' = record.action ?? 'approve'
  const newStatus = action === 'approve' ? 'active' : 'rejected'

  // Atualizar status do usuário
  await supabase
    .from('profiles')
    .update({ status: newStatus })
    .eq('id', record.user_id)

  // Marcar token como usado
  await supabase
    .from('user_approval_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', record.id)

  // Buscar email do usuário para mensagem de feedback
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', record.user_id)
    .maybeSingle()

  const userEmail = profile?.email ?? ''
  const userName  = profile?.full_name ?? userEmail

  if (action === 'approve') {
    // Enviar e-mail de boas-vindas ao usuário (opcional — usa Resend se tiver key)
    await notifyUserApproved(supabase, userEmail, userName)
    return Response.redirect(`${APP_URL}/login?approved=true`, 302)
  } else {
    return html(`
      <div style="font-family:Arial;max-width:500px;margin:60px auto;text-align:center;padding:20px">
        <h2 style="color:#ef4444">Acesso Rejeitado</h2>
        <p>O acesso de <strong>${userName}</strong> (${userEmail}) foi rejeitado.</p>
        <a href="${APP_URL}/super-admin/users" style="color:#7c3aed">← Voltar ao painel</a>
      </div>`, 200)
  }
})

async function notifyUserApproved(supabase: any, email: string, name: string) {
  if (!email) return
  const { data: s } = await supabase
    .from('platform_settings').select('value').is('organization_id', null).eq('key', 'resend_api_key').maybeSingle()
  const key = s?.value || Deno.env.get('RESEND_API_KEY')
  if (!key) return

  const { data: f } = await supabase
    .from('platform_settings').select('value').is('organization_id', null).eq('key', 'email_from').maybeSingle()
  const from = f?.value || 'noreply@chatatender.com.br'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    `ChatAtender <${from}>`,
      to:      [email],
      subject: '✅ Seu acesso foi aprovado — ChatAtender',
      html: `
        <div style="font-family:Arial;max-width:560px;margin:0 auto;padding:32px">
          <h2 style="color:#7c3aed">Acesso aprovado!</h2>
          <p>Olá <strong>${name}</strong>,</p>
          <p>Seu acesso à plataforma <strong>ChatAtender</strong> foi aprovado.</p>
          <p style="margin-top:24px">
            <a href="https://chatatender.vercel.app/login"
               style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Acessar plataforma →
            </a>
          </p>
        </div>`,
    }),
  })
}

function html(body: string, status = 200) {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <style>body{font-family:Arial,sans-serif;background:#f4f4f4;padding:40px}</style>
    </head><body>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

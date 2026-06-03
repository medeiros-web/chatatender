import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPER_ADMIN_EMAIL = 'medeirosassessor.adv@gmail.com'
const APP_URL = 'https://chatatender.vercel.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/approve-user`

serve(async (req) => {
  try {
    const { user_id, email, full_name } = await req.json()
    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: 'user_id e email são obrigatórios' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Criar tokens de aprovação e rejeição
    const { data: approveToken } = await supabase
      .from('user_approval_tokens')
      .insert({ user_id, action: 'approve' })
      .select('token')
      .single()

    const { data: rejectToken } = await supabase
      .from('user_approval_tokens')
      .insert({ user_id, action: 'reject' })
      .select('token')
      .single()

    const approveUrl = `${FUNCTION_URL}?token=${approveToken?.token}`
    const rejectUrl  = `${FUNCTION_URL}?token=${rejectToken?.token}`

    // Buscar Resend API key de platform_settings
    const { data: setting } = await supabase
      .from('platform_settings')
      .select('value')
      .is('organization_id', null)
      .eq('key', 'resend_api_key')
      .maybeSingle()

    const resendKey = setting?.value || Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY não configurado')
      return new Response(JSON.stringify({ ok: false, reason: 'no resend key' }), { status: 200 })
    }

    const { data: fromSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .is('organization_id', null)
      .eq('key', 'email_from')
      .maybeSingle()

    const fromEmail = fromSetting?.value || 'noreply@chatatender.com.br'

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:20px; }
  .container { max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
  .header { background: linear-gradient(135deg,#7c3aed,#6d28d9); padding:32px; text-align:center; }
  .header h1 { color:#fff; margin:0; font-size:22px; }
  .body { padding:32px; }
  .user-info { background:#f8f7ff; border:1px solid #e9d5ff; border-radius:8px; padding:16px; margin:16px 0; }
  .user-info p { margin:4px 0; color:#4b5563; font-size:14px; }
  .user-info strong { color:#1f2937; }
  .btn { display:inline-block; padding:12px 28px; border-radius:8px; font-size:15px; font-weight:600; text-decoration:none; margin:8px 4px; }
  .btn-approve { background:#10b981; color:#fff; }
  .btn-reject  { background:#ef4444; color:#fff; }
  .footer { padding:16px 32px; background:#f9fafb; font-size:12px; color:#9ca3af; text-align:center; }
</style></head>
<body>
<div class="container">
  <div class="header"><h1>🔔 Novo cadastro aguardando aprovação</h1></div>
  <div class="body">
    <p>Um novo usuário se cadastrou na plataforma <strong>ChatAtender</strong> e está aguardando sua aprovação para acessar.</p>
    <div class="user-info">
      <p><strong>Nome:</strong> ${full_name || '—'}</p>
      <p><strong>E-mail:</strong> ${email}</p>
      <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    </div>
    <p style="margin-top:24px;text-align:center;">
      <a href="${approveUrl}" class="btn btn-approve">✅ Aprovar acesso</a>
      <a href="${rejectUrl}" class="btn btn-reject">❌ Rejeitar</a>
    </p>
    <p style="font-size:13px;color:#6b7280;margin-top:16px;">
      Ou acesse o painel de controle: <a href="${APP_URL}/super-admin/users">${APP_URL}/super-admin/users</a>
    </p>
  </div>
  <div class="footer">ChatAtender Platform — notificação automática</div>
</div>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `ChatAtender <${fromEmail}>`,
        to:   [SUPER_ADMIN_EMAIL],
        subject: `[ChatAtender] Novo cadastro: ${full_name || email} aguardando aprovação`,
        html,
      }),
    })

    const resBody = await res.json()
    return new Response(JSON.stringify({ ok: res.ok, resend: resBody }), { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

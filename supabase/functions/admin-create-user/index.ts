import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Verificar JWT do chamador
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verificar se o chamador é super_admin
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Unauthorized' }, 401)

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (callerRole?.role !== 'super_admin') {
      return json({ error: 'Forbidden: apenas super_admin pode criar usuários' }, 403)
    }

    // Ler payload
    const { email, password, full_name, role, organization_id } = await req.json()

    if (!email || !password || !full_name || !role || !organization_id) {
      return json({ error: 'Campos obrigatórios: email, password, full_name, role, organization_id' }, 400)
    }

    const VALID_ROLES = ['super_admin', 'admin', 'manager', 'agent']
    if (!VALID_ROLES.includes(role)) {
      return json({ error: `Role inválido. Use: ${VALID_ROLES.join(', ')}` }, 400)
    }

    // Verificar se email já existe
    const { data: { users: existing } } = await supabaseAdmin.auth.admin.listUsers()
    if (existing.some(u => u.email === email)) {
      return json({ error: 'Este e-mail já está cadastrado' }, 409)
    }

    // 1. Criar usuário no auth
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createErr || !newUser.user) {
      return json({ error: createErr?.message ?? 'Erro ao criar usuário' }, 500)
    }

    const userId = newUser.user.id

    // 2. Upsert profile
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      organization_id,
      full_name,
      email,
      status: 'active',
    }, { onConflict: 'id' })
    if (profileErr) return json({ error: profileErr.message }, 500)

    // 3. Upsert user_role
    const { error: roleErr } = await supabaseAdmin.from('user_roles')
      .upsert({ user_id: userId, organization_id, role }, { onConflict: 'user_id,organization_id' })
    if (roleErr) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
      await supabaseAdmin.from('user_roles').insert({ user_id: userId, organization_id, role })
    }

    // 4. Inicializar permissões padrão via RPC (se existir)
    await supabaseAdmin.rpc('initialize_user_permissions', {
      p_user_id: userId,
      p_org_id: organization_id,
      p_role: role,
    }).catch(() => {})

    return json({
      success: true,
      user_id: userId,
      email,
      full_name,
      role,
      organization_id,
    })
  } catch (e: any) {
    return json({ error: e.message ?? 'Erro interno' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

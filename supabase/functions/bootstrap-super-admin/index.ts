import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Aceita POST com { email, password } OU lê SUPER_ADMIN_EMAIL do env
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let email: string | undefined
  let password: string | undefined

  try {
    const body = await req.json()
    email    = body.email    || Deno.env.get('SUPER_ADMIN_EMAIL')
    password = body.password || Deno.env.get('SUPER_ADMIN_PASSWORD')
  } catch {
    email    = Deno.env.get('SUPER_ADMIN_EMAIL')
    password = Deno.env.get('SUPER_ADMIN_PASSWORD')
  }

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'email é obrigatório (body ou SUPER_ADMIN_EMAIL env)' }),
      { status: 400 }
    )
  }

  // 1. Buscar usuário pelo email
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), { status: 500 })
  }

  let userId: string | undefined = users.find(u => u.email === email)?.id

  // 2. Se não existir e tiver senha, criar
  if (!userId && password) {
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Super Admin' },
    })
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 500 })
    }
    userId = newUser.user?.id
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Usuário não encontrado e sem senha para criação' }),
      { status: 404 }
    )
  }

  // 3. Garantir que existe uma org "ChatAtender Platform"
  let { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'chatatender-platform')
    .maybeSingle()

  if (!org) {
    const { data: newOrg, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: 'ChatAtender Platform', slug: 'chatatender-platform', is_active: true })
      .select('id')
      .single()
    if (orgErr) {
      return new Response(JSON.stringify({ error: orgErr.message }), { status: 500 })
    }
    org = newOrg
  }

  const orgId = org.id

  // 4. Upsert profile
  await supabase.from('profiles').upsert({
    id: userId,
    organization_id: orgId,
    full_name: 'Super Admin',
  }, { onConflict: 'id' })

  // 5. Upsert user_role como super_admin
  const { error: roleErr } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, organization_id: orgId, role: 'super_admin' }, {
      onConflict: 'user_id,organization_id',
    })

  if (roleErr) {
    // Fallback: delete + insert
    await supabase.from('user_roles').delete().eq('user_id', userId)
    await supabase.from('user_roles').insert({
      user_id: userId, organization_id: orgId, role: 'super_admin',
    })
  }

  // 6. Semear platform_settings globais básicos
  const seeds = [
    { key: 'platform_name',    value: 'ChatAtender', is_secret: false },
    { key: 'allow_signup',     value: 'true',        is_secret: false },
    { key: 'maintenance_mode', value: 'false',       is_secret: false },
  ]
  for (const seed of seeds) {
    const exists = await supabase
      .from('platform_settings')
      .select('id')
      .is('organization_id', null)
      .eq('key', seed.key)
      .maybeSingle()
    if (!exists.data) {
      await supabase.from('platform_settings').insert({
        organization_id: null,
        key: seed.key,
        value: seed.value,
        is_secret: seed.is_secret,
      })
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      user_id: userId,
      email,
      role: 'super_admin',
      organization_id: orgId,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

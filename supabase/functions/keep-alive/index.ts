import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Lightweight query — apenas confirma que o banco responde
  const { count, error } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })

  const ts = new Date().toISOString()

  if (error) {
    console.error(`[keep-alive] ${ts} — erro: ${error.message}`)
    return new Response(JSON.stringify({ ok: false, error: error.message, ts }), { status: 500 })
  }

  console.log(`[keep-alive] ${ts} — ok (${count} orgs)`)
  return new Response(JSON.stringify({ ok: true, orgs: count, ts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

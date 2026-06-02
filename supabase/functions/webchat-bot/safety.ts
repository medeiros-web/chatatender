import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':  { input: 0.00000025, output: 0.00000125 },
  'claude-sonnet-4-5': { input: 0.000003,   output: 0.000015 },
  'claude-opus-4-5':   { input: 0.000015,   output: 0.000075 },
  'gpt-4o':            { input: 0.000005,   output: 0.000015 },
  'gpt-4o-mini':       { input: 0.00000015, output: 0.0000006 },
}

export async function checkSafetyLimits(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: limits } = await supabase
    .from('agent_safety_limits')
    .select('*')
    .eq('organization_id', orgId)
    .single()

  if (!limits) return { allowed: true }

  // Reseta contadores se novo dia
  const lastReset = new Date(limits.last_reset_at as string)
  if (lastReset.toDateString() !== new Date().toDateString()) {
    await supabase.from('agent_safety_limits').update({
      current_day_executions: 0,
      current_day_cost_usd: 0,
      last_reset_at: new Date().toISOString(),
      is_paused: false,
    }).eq('organization_id', orgId)
    return { allowed: true }
  }

  if (limits.is_paused) {
    return { allowed: false, reason: `Agente pausado: ${limits.pause_reason ?? 'limite atingido'}` }
  }
  if ((limits.current_day_executions as number) >= (limits.max_executions_per_day as number)) {
    await supabase.from('agent_safety_limits').update({ is_paused: true, pause_reason: 'limite de execuções diário atingido' }).eq('organization_id', orgId)
    return { allowed: false, reason: 'Limite diário de 5000 execuções atingido' }
  }
  if ((limits.current_day_cost_usd as number) >= (limits.max_cost_usd_per_day as number)) {
    await supabase.from('agent_safety_limits').update({ is_paused: true, pause_reason: 'limite de custo diário atingido' }).eq('organization_id', orgId)
    return { allowed: false, reason: 'Limite de custo $500/dia atingido' }
  }

  return { allowed: true }
}

export async function recordUsage(
  supabase: SupabaseClient,
  orgId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<void> {
  const costs = MODEL_COSTS[model] ?? { input: 0.000003, output: 0.000015 }
  const cost = (inputTokens * costs.input) + (outputTokens * costs.output)

  // Incrementa counters
  const { data: limits } = await supabase.from('agent_safety_limits').select('current_day_executions, current_day_cost_usd').eq('organization_id', orgId).single()
  if (limits) {
    await supabase.from('agent_safety_limits').update({
      current_day_executions: (limits.current_day_executions as number) + 1,
      current_day_cost_usd: parseFloat(((limits.current_day_cost_usd as number) + cost).toFixed(6)),
    }).eq('organization_id', orgId)
  }
}

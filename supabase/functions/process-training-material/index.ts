import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CHUNK_SIZE    = 600
const CHUNK_OVERLAP = 80

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end).trim())
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks.filter(c => c.length > 30)
}

async function embedText(text: string, openAIKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: [text] }),
  })
  if (!res.ok) throw new Error(`OpenAI embed error: ${await res.text()}`)
  const data = await res.json() as { data: { embedding: number[] }[] }
  return data.data[0].embedding
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json() as {
    organization_id: string
    agent_id?: string
    title: string
    content: string
    type?: string
    material_id?: string
  }

  const { organization_id, agent_id, title, content, type = 'text', material_id } = body

  if (!organization_id || !title || !content) {
    return new Response(JSON.stringify({ error: 'organization_id, title and content are required' }), { status: 400 })
  }

  const { data: cfgRows } = await supabase
    .from('platform_settings').select('key,value').eq('key', 'openai_api_key')
  const openAIKey = cfgRows?.[0]?.value || Deno.env.get('OPENAI_API_KEY') || ''

  if (!openAIKey) {
    return new Response(JSON.stringify({ error: 'openai_api_key not configured' }), { status: 500 })
  }

  try {
    // If updating existing material: delete old and re-insert
    if (material_id) {
      await supabase.from('agent_training_materials').delete().eq('id', material_id)
    }

    const chunks = chunkText(content)
    const insertedIds: string[] = []

    for (const [i, chunk] of chunks.entries()) {
      const embedding = await embedText(chunk, openAIKey)
      const { data, error } = await supabase.from('agent_training_materials').insert({
        organization_id,
        agent_id: agent_id ?? null,
        title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
        content: chunk,
        type,
        embedding: embedding as unknown as string,
      }).select('id').single()
      if (error) throw new Error(error.message)
      if (data) insertedIds.push(data.id)
    }

    return new Response(
      JSON.stringify({ success: true, chunks: insertedIds.length, ids: insertedIds }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

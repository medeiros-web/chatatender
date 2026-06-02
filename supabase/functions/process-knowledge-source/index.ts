import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CHUNK_SIZE   = 800   // characters per chunk
const CHUNK_OVERLAP = 100  // overlap between chunks

interface SourceRow {
  id: string
  organization_id: string
  type: string
  source_url: string | null
  file_path: string | null
  title: string | null
}

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end).trim())
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks.filter(c => c.length > 40)
}

async function fetchPageText(url: string, firecrawlKey: string): Promise<string> {
  const res = await fetch('https://api.firecrawl.dev/v0/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, pageOptions: { onlyMainContent: true } }),
  })
  if (!res.ok) throw new Error(`Firecrawl error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { data?: { markdown?: string; content?: string } }
  return data.data?.markdown ?? data.data?.content ?? ''
}

async function embedChunks(chunks: string[], openAIKey: string): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: chunks,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI embed error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { data: { embedding: number[] }[] }
  return data.data.map(d => d.embedding)
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { source_id } = await req.json() as { source_id?: string }

  // Allow cron-style: pick next pending if no source_id given
  let source: SourceRow | null = null
  if (source_id) {
    const { data } = await supabase.from('product_knowledge_sources')
      .select('id,organization_id,type,source_url,file_path,title')
      .eq('id', source_id).single()
    source = data
  } else {
    const { data } = await supabase.from('product_knowledge_sources')
      .select('id,organization_id,type,source_url,file_path,title')
      .eq('status', 'pending').limit(1).single()
    source = data
  }

  if (!source) {
    return new Response(JSON.stringify({ done: true, message: 'no pending sources' }), { status: 200 })
  }

  // Mark as processing
  await supabase.from('product_knowledge_sources')
    .update({ status: 'processing' }).eq('id', source.id)

  try {
    // Fetch credentials
    const { data: cfgRows } = await supabase
      .from('platform_settings').select('key,value')
      .in('key', ['openai_api_key', 'firecrawl_api_key'])
    const cfg: Record<string, string> = {}
    for (const r of (cfgRows ?? [])) cfg[r.key] = r.value ?? ''

    const openAIKey    = cfg['openai_api_key']    || Deno.env.get('OPENAI_API_KEY') || ''
    const firecrawlKey = cfg['firecrawl_api_key'] || Deno.env.get('FIRECRAWL_API_KEY') || ''

    if (!openAIKey) throw new Error('openai_api_key not configured')

    // Fetch content
    let rawText = ''
    if (source.type === 'url' && source.source_url) {
      if (!firecrawlKey) throw new Error('firecrawl_api_key not configured for URL sources')
      rawText = await fetchPageText(source.source_url, firecrawlKey)
    } else {
      throw new Error(`Unsupported source type: ${source.type}`)
    }

    if (!rawText.trim()) throw new Error('No content extracted from source')

    const chunks = chunkText(rawText)
    const embeddings = await embedChunks(chunks, openAIKey)

    // Delete old chunks for this source
    await supabase.from('ai_knowledge_base').delete().eq('source_id', source.id)

    // Insert new chunks
    const rows = chunks.map((content, i) => ({
      organization_id: source!.organization_id,
      source_id: source!.id,
      title: source!.title ?? source!.source_url ?? 'Chunk',
      content,
      chunk_index: i,
      embedding: embeddings[i] as unknown as string,
      token_count: Math.ceil(content.length / 4),
    }))

    const { error: insertErr } = await supabase.from('ai_knowledge_base').insert(rows)
    if (insertErr) throw new Error(insertErr.message)

    await supabase.from('product_knowledge_sources').update({
      status: 'done',
      chunk_count: chunks.length,
      error_message: null,
    }).eq('id', source.id)

    return new Response(
      JSON.stringify({ success: true, source_id: source.id, chunks: chunks.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('product_knowledge_sources').update({
      status: 'failed',
      error_message: message,
    }).eq('id', source.id)

    return new Response(
      JSON.stringify({ success: false, source_id: source.id, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

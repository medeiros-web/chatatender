import { useState } from 'react'
import { Brain, Globe, FileText, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Upload, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  useKnowledgeSources, useAddKnowledgeSource, useProcessKnowledgeSource,
  useDeleteKnowledgeSource, useKnowledgeEntries,
  useTrainingMaterials, useAddTrainingMaterial, useDeleteTrainingMaterial,
  useAIAudits,
  type KnowledgeSource, type TrainingMaterial,
} from '@/hooks/useBrain'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<KnowledgeSource['status'], { label: string; icon: React.ElementType; cls: string }> = {
  pending:    { label: 'Pendente',    icon: Clock,         cls: 'text-muted-foreground' },
  processing: { label: 'Processando', icon: RefreshCw,     cls: 'text-yellow-500 animate-spin' },
  done:       { label: 'Pronto',      icon: CheckCircle2,  cls: 'text-green-500' },
  failed:     { label: 'Erro',        icon: XCircle,       cls: 'text-destructive' },
}

const TYPE_MATERIAL: { value: TrainingMaterial['type']; label: string }[] = [
  { value: 'text',       label: 'Texto livre' },
  { value: 'faq',        label: 'Perguntas & respostas' },
  { value: 'script',     label: 'Script de vendas' },
  { value: 'objection',  label: 'Objeções' },
]

function SourceCard({ source }: { source: KnowledgeSource }) {
  const process   = useProcessKnowledgeSource()
  const del       = useDeleteKnowledgeSource()
  const { icon: StatusIcon, label, cls } = STATUS_MAP[source.status]

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-4">
      <Globe className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{source.title ?? source.source_url ?? '—'}</p>
        {source.source_url && (
          <p className="text-xs text-muted-foreground truncate">{source.source_url}</p>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          <span className={cn('flex items-center gap-1 text-xs', cls)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {label}
          </span>
          {source.status === 'done' && (
            <span className="text-xs text-muted-foreground">{source.chunk_count} chunks</span>
          )}
          {source.error_message && (
            <span className="text-xs text-destructive truncate max-w-[200px]">{source.error_message}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {(source.status === 'pending' || source.status === 'failed') && (
          <Button
            variant="outline" size="sm"
            onClick={() => process.mutate(source.id)}
            disabled={process.isPending}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', process.isPending && 'animate-spin')} />
            Processar
          </Button>
        )}
        <Button
          variant="ghost" size="icon-sm"
          onClick={() => del.mutate(source.id)}
          disabled={del.isPending}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Add Source Dialog ─────────────────────────────────────────────────────────

function AddSourceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add     = useAddKnowledgeSource()
  const process = useProcessKnowledgeSource()
  const [url, setUrl]     = useState('')
  const [title, setTitle] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    const source = await add.mutateAsync({ type: 'url', source_url: url.trim(), title: title.trim() || undefined })
    process.mutate(source.id)
    onClose()
    setUrl(''); setTitle('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar fonte de conhecimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">URL da página</label>
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://exemplo.com/produto"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Título (opcional)</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Página de vendas do produto X"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={add.isPending || !url.trim()}>
              Adicionar e processar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Training Material Dialog ──────────────────────────────────────────────────

function AddMaterialDialog({ open, onClose, agentId }: { open: boolean; onClose: () => void; agentId?: string }) {
  const add = useAddTrainingMaterial()
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [type,    setType]    = useState<TrainingMaterial['type']>('text')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    await add.mutateAsync({ title: title.trim(), content: content.trim(), type, agent_id: agentId })
    onClose()
    setTitle(''); setContent(''); setType('text')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar material de treinamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Título</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: FAQ sobre produto X" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {TYPE_MATERIAL.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    type === t.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Conteúdo</label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              required
              placeholder="Cole aqui o texto, FAQ, script ou lista de objeções..."
              className="font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={add.isPending || !title.trim() || !content.trim()}>
              {add.isPending ? 'Processando embeddings...' : 'Salvar e vetorizar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Knowledge entries panel ───────────────────────────────────────────────────

function EntriesPanel() {
  const { data: entries = [], isLoading } = useKnowledgeEntries()

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <span className="text-sm font-medium text-foreground">Chunks vetorizados</span>
        <Badge variant="secondary">{entries.length}</Badge>
      </div>
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {isLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-muted m-2 rounded-lg" />)
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum chunk indexado ainda
          </div>
        ) : entries.map(e => (
          <div key={e.id} className="px-4 py-3">
            <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.content}</p>
            {e.token_count && (
              <span className="text-[10px] text-muted-foreground">{e.token_count} tokens</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Audits panel ──────────────────────────────────────────────────────────────

function AuditsPanel() {
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const { data: audits = [], isLoading } = useAIAudits(flaggedOnly)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Auditoria de respostas IA</h2>
        <button
          onClick={() => setFlaggedOnly(v => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
            flaggedOnly
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {flaggedOnly ? 'Mostrando sinalizados' : 'Mostrar só sinalizados'}
        </button>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : audits.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum registro de auditoria
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Input</th>
                <th className="px-4 py-2.5 text-left">Output</th>
                <th className="px-4 py-2.5 text-right">Score</th>
                <th className="px-4 py-2.5 text-right">Tokens</th>
                <th className="px-4 py-2.5 text-right">Latência</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audits.map(a => (
                <tr key={a.id} className={cn('transition-colors hover:bg-muted/20', a.flagged && 'bg-destructive/5')}>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="truncate text-foreground">{a.input_text}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[250px]">
                    <p className="truncate text-muted-foreground">{a.output_text}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.score != null ? (
                      <span className={cn('font-mono text-xs', a.score >= 0.7 ? 'text-green-600' : a.score >= 0.4 ? 'text-yellow-600' : 'text-destructive')}>
                        {(a.score * 100).toFixed(0)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {a.token_input != null ? `${(a.token_input ?? 0) + (a.token_output ?? 0)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {a.latency_ms != null ? `${a.latency_ms}ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.flagged
                      ? <Badge variant="destructive" className="text-[10px]">Sinalizado</Badge>
                      : <Badge variant="secondary" className="text-[10px]">OK</Badge>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BrainPage() {
  const { data: sources = [], isLoading: loadingSources } = useKnowledgeSources()
  const { data: materials = [], isLoading: loadingMaterials } = useTrainingMaterials()
  const delMaterial = useDeleteTrainingMaterial()
  const [addSourceOpen,   setAddSourceOpen]   = useState(false)
  const [addMaterialOpen, setAddMaterialOpen] = useState(false)

  const doneSources = sources.filter(s => s.status === 'done').length
  const totalChunks = sources.reduce((acc, s) => acc + (s.chunk_count ?? 0), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Brain — Base de Conhecimento IA
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vetorize conteúdo para alimentar os agentes com contexto relevante
          </p>
        </div>
        <div className="flex gap-2">
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{totalChunks}</p>
            <p className="text-xs text-muted-foreground">chunks indexados</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Fontes ativas',       value: `${doneSources}/${sources.length}`, icon: Globe },
          { label: 'Materiais treinados', value: materials.length,                   icon: FileText },
          { label: 'Chunks vetorizados',  value: totalChunks,                        icon: Brain },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Fontes de URL</TabsTrigger>
          <TabsTrigger value="materials">Materiais de Treinamento</TabsTrigger>
          <TabsTrigger value="entries">Chunks Indexados</TabsTrigger>
          <TabsTrigger value="audits">Auditoria IA</TabsTrigger>
        </TabsList>

        {/* Sources tab */}
        <TabsContent value="sources" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">URLs processadas via Firecrawl → chunks → embeddings</p>
            <Button onClick={() => setAddSourceOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar URL
            </Button>
          </div>
          {loadingSources ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)
          ) : sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">Nenhuma fonte adicionada</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddSourceOpen(true)}>
                Adicionar primeira URL
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map(s => <SourceCard key={s.id} source={s} />)}
            </div>
          )}
        </TabsContent>

        {/* Materials tab */}
        <TabsContent value="materials" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Scripts, FAQs, objeções — vetorizados para o agente</p>
            <Button onClick={() => setAddMaterialOpen(true)} size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" /> Adicionar material
            </Button>
          </div>
          {loadingMaterials ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)
          ) : materials.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">Nenhum material adicionado</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddMaterialOpen(true)}>
                Adicionar primeiro material
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {materials.map(m => (
                <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.content}</p>
                    <Badge variant="secondary" className="mt-1.5 text-[10px]">
                      {TYPE_MATERIAL.find(t => t.value === m.type)?.label ?? m.type}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost" size="icon-sm"
                    onClick={() => delMaterial.mutate(m.id)}
                    className="text-destructive hover:text-destructive flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Entries tab */}
        <TabsContent value="entries" className="mt-4">
          <EntriesPanel />
        </TabsContent>

        {/* Audits tab */}
        <TabsContent value="audits" className="mt-4">
          <AuditsPanel />
        </TabsContent>
      </Tabs>

      <AddSourceDialog   open={addSourceOpen}   onClose={() => setAddSourceOpen(false)} />
      <AddMaterialDialog open={addMaterialOpen} onClose={() => setAddMaterialOpen(false)} />
    </div>
  )
}

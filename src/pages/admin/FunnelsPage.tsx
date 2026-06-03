import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Zap, Plus, Pencil, Trash2, Copy, Eye, BarChart3,
  Globe, Link2, CheckCircle2, Archive, FileEdit,
  MousePointerClick, Bot, Webhook, GitBranch, CalendarCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useProducts } from '@/hooks/useProducts'
import {
  useFunnels, useCreateFunnel, useUpdateFunnel, useDeleteFunnel, useFunnelAnalytics,
  type CaptureFunnel, type FunnelBlockType, type FunnelBlock,
} from '@/hooks/useFunnels'

// ── Helpers ───────────────────────────────────────────────────
function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'muted' }> = {
  active:   { label: 'Ativo',    variant: 'default' },
  draft:    { label: 'Rascunho', variant: 'muted' },
  archived: { label: 'Arquivado', variant: 'secondary' },
}

const BLOCK_TYPES: { type: FunnelBlockType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'question',    label: 'Pergunta',         icon: MousePointerClick, color: 'text-primary' },
  { type: 'statement',   label: 'Texto/Enunciado',  icon: FileEdit,          color: 'text-accent' },
  { type: 'capture',     label: 'Captura de dados', icon: CheckCircle2,      color: 'text-success' },
  { type: 'schedule',    label: 'Agendamento',      icon: CalendarCheck,     color: 'text-warning' },
  { type: 'condition',   label: 'Condição',         icon: GitBranch,         color: 'text-secondary-foreground' },
  { type: 'ai_takeover', label: 'IA assume',        icon: Bot,               color: 'text-purple-400' },
  { type: 'webhook',     label: 'Webhook',          icon: Webhook,           color: 'text-muted-foreground' },
  { type: 'redirect',    label: 'Redirecionar',     icon: Link2,             color: 'text-muted-foreground' },
]

// ── Block Editor ──────────────────────────────────────────────
function BlockEditor({
  block, onChange, onDelete,
}: {
  block: FunnelBlock
  onChange: (b: FunnelBlock) => void
  onDelete: () => void
}) {
  const meta = BLOCK_TYPES.find(t => t.type === block.type)
  const Icon = meta?.icon ?? FileEdit

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className={cn('h-3.5 w-3.5', meta?.color)} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
          {meta?.label}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Título do bloco"
          value={block.title}
          onChange={e => onChange({ ...block, title: e.target.value })}
          className="h-8 text-sm"
        />
        {block.description !== undefined && (
          <Input
            placeholder="Descrição (opcional)"
            value={block.description ?? ''}
            onChange={e => onChange({ ...block, description: e.target.value })}
            className="h-8 text-sm"
          />
        )}
      </div>

      {block.type === 'question' && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Opções de resposta</p>
          {(block.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={opt.label}
                onChange={e => {
                  const opts = [...(block.options ?? [])]
                  opts[i] = { ...opts[i], label: e.target.value, value: slugify(e.target.value) }
                  onChange({ ...block, options: opts })
                }}
                className="h-7 text-xs flex-1"
                placeholder={`Opção ${i + 1}`}
              />
              <Button variant="ghost" size="icon-sm"
                onClick={() => onChange({ ...block, options: (block.options ?? []).filter((_, j) => j !== i) })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs h-7"
            onClick={() => onChange({ ...block, options: [...(block.options ?? []), { label: '', value: '' }] })}>
            <Plus className="h-3 w-3" /> Adicionar opção
          </Button>
        </div>
      )}

      {(block.type === 'redirect' || block.type === 'webhook') && (
        <Input
          placeholder={block.type === 'redirect' ? 'https://seusite.com/obrigado' : 'https://hooks.example.com/...'}
          value={(block.settings?.url as string) ?? ''}
          onChange={e => onChange({ ...block, settings: { ...block.settings, url: e.target.value } })}
          className="h-8 text-xs"
        />
      )}
    </div>
  )
}

// ── Funnel Form Dialog ────────────────────────────────────────
const funnelSchema = z.object({
  name:       z.string().min(1, 'Obrigatório'),
  slug:       z.string().min(1, 'Obrigatório').regex(/^[a-z0-9-]+$/, 'Apenas letras, números e hífens'),
  description: z.string().optional(),
  status:     z.enum(['draft', 'active', 'archived']),
  product_id: z.string().optional(),
})
type FunnelValues = z.infer<typeof funnelSchema>

function FunnelFormDialog({
  open, onClose, existing,
}: {
  open: boolean
  onClose: () => void
  existing?: CaptureFunnel | null
}) {
  const { data: products = [] } = useProducts()
  const create = useCreateFunnel()
  const update = useUpdateFunnel()

  const [blocks, setBlocks] = useState<FunnelBlock[]>(existing?.blocks ?? [])

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FunnelValues>({
    resolver: zodResolver(funnelSchema),
    defaultValues: {
      name:       existing?.name ?? '',
      slug:       existing?.slug ?? '',
      description: existing?.description ?? '',
      status:     existing?.status ?? 'draft',
      product_id: existing?.product_id ?? '',
    },
  })

  const nameVal = watch('name')

  const addBlock = (type: FunnelBlockType) => {
    const newBlock: FunnelBlock = {
      id: genId(), type, title: '',
      description: '', options: type === 'question' ? [] : undefined,
    }
    setBlocks(prev => [...prev, newBlock])
  }

  const onSubmit = async (values: FunnelValues) => {
    const payload = {
      ...values,
      product_id: values.product_id || null,
      blocks,
      start_block_id: blocks[0]?.id ?? null,
    }
    if (existing) {
      await update.mutateAsync({ id: existing.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            {existing ? 'Editar funil' : 'Novo funil'}
          </DialogTitle>
          <DialogDescription>Configure o fluxo de blocos do funil de captura.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <Tabs defaultValue="config">
              <TabsList className="mb-4">
                <TabsTrigger value="config" className="text-xs">Configuração</TabsTrigger>
                <TabsTrigger value="blocks" className="text-xs">Blocos ({blocks.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome do funil</Label>
                    <Input placeholder="Ex: Funil Produto X"
                      {...register('name')}
                      onChange={e => {
                        setValue('name', e.target.value)
                        if (!existing) setValue('slug', slugify(e.target.value))
                      }}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug (URL pública)</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/funnel/</span>
                      <Input placeholder="meu-funil" {...register('slug')} className="flex-1" />
                    </div>
                    {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Descrição interna</Label>
                  <Input placeholder="Uso interno" {...register('description')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select defaultValue={watch('status')} onValueChange={v => setValue('status', v as 'draft' | 'active' | 'archived')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="archived">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Produto associado</Label>
                    <Select defaultValue={watch('product_id') || '__none__'} onValueChange={v => setValue('product_id', v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="blocks" className="space-y-3 max-h-[50vh] overflow-y-auto">
                {/* Blocos existentes */}
                {blocks.map((block, i) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    onChange={updated => setBlocks(prev => prev.map((b, j) => j === i ? updated : b))}
                    onDelete={() => setBlocks(prev => prev.filter((_, j) => j !== i))}
                  />
                ))}

                {blocks.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Adicione blocos ao funil abaixo
                  </div>
                )}

                {/* Adicionar bloco */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar bloco</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {BLOCK_TYPES.map(bt => {
                      const Icon = bt.icon
                      return (
                        <button key={bt.type} type="button"
                          onClick={() => addBlock(bt.type)}
                          className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-2 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                          <Icon className={cn('h-4 w-4', bt.color)} />
                          <span className="text-[10px] text-muted-foreground text-center leading-tight">{bt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>
              {existing ? 'Salvar funil' : 'Criar funil'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Analytics Card ────────────────────────────────────────────
function FunnelAnalyticsInline({ funnelId }: { funnelId: string }) {
  const { data } = useFunnelAnalytics(funnelId)
  if (!data) return null
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Eye className="h-3 w-3" /> {data.total_views}
      </span>
      <span className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-success" /> {data.total_completions}
      </span>
      {data.total_views > 0 && (
        <span className="font-mono text-primary">{data.conversion_rate}%</span>
      )}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  FunnelsPage                                             ║
// ╚══════════════════════════════════════════════════════════╝
export function FunnelsPage() {
  const { data: funnels = [], isLoading } = useFunnels()
  const deleteFunnel = useDeleteFunnel()
  const updateFunnel = useUpdateFunnel()

  const [formOpen, setFormOpen] = useState<{ existing?: CaptureFunnel } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const activeCount   = funnels.filter(f => f.status === 'active').length
  const draftCount    = funnels.filter(f => f.status === 'draft').length
  const archiveCount  = funnels.filter(f => f.status === 'archived').length

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/funnel/${slug}`)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Funis de Captura</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie fluxos interativos para capturar e qualificar leads automaticamente.
          </p>
        </div>
        <Button onClick={() => setFormOpen({})}>
          <Plus className="h-4 w-4" /> Novo funil
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ativos',    value: activeCount,  icon: Globe,   color: 'text-success' },
          { label: 'Rascunho',  value: draftCount,   icon: FileEdit, color: 'text-warning' },
          { label: 'Arquivados', value: archiveCount, icon: Archive,  color: 'text-muted-foreground' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className={cn('h-5 w-5', stat.color)} />
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />)}
        </div>
      ) : funnels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Zap className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum funil criado ainda.</p>
            <Button size="sm" onClick={() => setFormOpen({})}>
              <Plus className="h-3.5 w-3.5" /> Criar primeiro funil
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {funnels.map(funnel => {
            const statusMeta = STATUS_META[funnel.status]
            return (
              <Card key={funnel.id} className="hover:border-border/80 transition-colors">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-foreground truncate">{funnel.name}</span>
                      <Badge variant={statusMeta.variant} className="text-[10px]">{statusMeta.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono">/funnel/{funnel.slug}</span>
                      <span className="text-xs text-muted-foreground">· {funnel.blocks.length} blocos</span>
                      <FunnelAnalyticsInline funnelId={funnel.id} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {funnel.status === 'active' && (
                      <Button variant="ghost" size="icon-sm" title="Copiar link"
                        onClick={() => copyLink(funnel.slug)}>
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" title="Visualizar"
                      onClick={() => window.open(`/funnel/${funnel.slug}`, '_blank')}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Editar"
                      onClick={() => setFormOpen({ existing: funnel })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Duplicar"
                      onClick={() => setFormOpen({ existing: { ...funnel, id: '', slug: funnel.slug + '-copy', status: 'draft' } })}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {funnel.status !== 'archived' ? (
                      <Button variant="ghost" size="icon-sm" title="Arquivar"
                        onClick={() => updateFunnel.mutate({ id: funnel.id, status: 'archived' })}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" title="Excluir"
                        onClick={() => setDeleteConfirm(funnel.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {formOpen !== null && (
        <FunnelFormDialog
          open
          onClose={() => setFormOpen(null)}
          existing={formOpen.existing}
        />
      )}

      {/* Confirm delete */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir funil?</DialogTitle>
            <DialogDescription>Esta ação é irreversível. Todas as análises serão perdidas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" loading={deleteFunnel.isPending}
              onClick={async () => {
                if (deleteConfirm) { await deleteFunnel.mutateAsync(deleteConfirm); setDeleteConfirm(null) }
              }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

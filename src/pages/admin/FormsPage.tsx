import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  FileText, Plus, Pencil, Trash2, Copy, Eye, Archive,
  Link2, ChevronUp, ChevronDown, GripVertical,
  ToggleLeft, ToggleRight, ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useProducts } from '@/hooks/useProducts'
import {
  useForms, useCreateForm, useUpdateForm, useDeleteForm,
  useFormBlocks, useSaveFormBlocks, useFormSubmissions,
  type Form, type FormBlock, type BlockType,
} from '@/hooks/useForms'

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

const BLOCK_TYPES: { type: BlockType; label: string; icon: string }[] = [
  { type: 'short_text',  label: 'Texto curto',    icon: '✏️' },
  { type: 'long_text',   label: 'Texto longo',    icon: '📝' },
  { type: 'email',       label: 'E-mail',         icon: '📧' },
  { type: 'phone',       label: 'Telefone',       icon: '📱' },
  { type: 'select',      label: 'Seleção única',  icon: '⊙' },
  { type: 'multiselect', label: 'Múltipla escolha', icon: '☑️' },
  { type: 'date',        label: 'Data',           icon: '📅' },
  { type: 'rating',      label: 'Avaliação',      icon: '⭐' },
  { type: 'statement',   label: 'Texto fixo',     icon: '💬' },
]

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'muted' }> = {
  active:   { label: 'Ativo',     variant: 'default' },
  draft:    { label: 'Rascunho',  variant: 'muted' },
  archived: { label: 'Arquivado', variant: 'secondary' },
}

// ── Block Editor Item ─────────────────────────────────────────
function BlockItem({
  block, index, total, onChange, onDelete, onMove,
}: {
  block: Partial<FormBlock>
  index: number
  total: number
  onChange: (b: Partial<FormBlock>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const meta = BLOCK_TYPES.find(t => t.type === block.block_type)
  const hasOptions = block.block_type === 'select' || block.block_type === 'multiselect'

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-base">{meta?.icon}</span>
        <span className="text-xs font-semibold text-muted-foreground flex-1">{meta?.label}</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Pergunta / rótulo"
          value={block.label ?? ''}
          onChange={e => onChange({ ...block, label: e.target.value })}
          className="h-8 text-sm"
        />
        {block.block_type !== 'statement' && (
          <Input
            placeholder="Texto de apoio (opcional)"
            value={block.description ?? ''}
            onChange={e => onChange({ ...block, description: e.target.value })}
            className="h-7 text-xs"
          />
        )}
      </div>

      {hasOptions && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Opções</p>
          {((block.options as { label: string; value: string }[]) ?? []).map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt.label}
                onChange={e => {
                  const opts = [...((block.options as { label: string; value: string }[]) ?? [])]
                  opts[i] = { label: e.target.value, value: slugify(e.target.value) }
                  onChange({ ...block, options: opts })
                }}
                className="h-7 text-xs flex-1"
                placeholder={`Opção ${i + 1}`}
              />
              <Button variant="ghost" size="icon-sm"
                onClick={() => onChange({ ...block, options: ((block.options as { label: string; value: string }[]) ?? []).filter((_, j) => j !== i) })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs h-7"
            onClick={() => onChange({ ...block, options: [...((block.options as { label: string; value: string }[]) ?? []), { label: '', value: '' }] })}>
            <Plus className="h-3 w-3" /> Opção
          </Button>
        </div>
      )}

      {block.block_type !== 'statement' && (
        <div className="flex items-center gap-2">
          <Switch
            checked={block.required ?? false}
            onCheckedChange={v => onChange({ ...block, required: v })}
          />
          <span className="text-xs text-muted-foreground">Obrigatório</span>
        </div>
      )}
    </div>
  )
}

// ── Form Builder Dialog ───────────────────────────────────────
const formSchema = z.object({
  name:          z.string().min(1, 'Obrigatório'),
  slug:          z.string().min(1).regex(/^[a-z0-9-]+$/),
  description:   z.string().optional(),
  status:        z.enum(['draft', 'active', 'archived']),
  product_id:    z.string().optional(),
  submit_message: z.string().optional(),
  redirect_url:  z.string().url().optional().or(z.literal('')),
  notify_email:  z.string().email().optional().or(z.literal('')),
})
type FormValues = z.infer<typeof formSchema>

function FormBuilderDialog({
  open, onClose, existing,
}: {
  open: boolean
  onClose: () => void
  existing?: Form | null
}) {
  const { data: products = [] } = useProducts()
  const { data: existingBlocks = [] } = useFormBlocks(existing?.id)
  const createForm = useCreateForm()
  const updateForm = useUpdateForm()
  const saveBlocks = useSaveFormBlocks()

  const [blocks, setBlocks] = useState<Partial<FormBlock>[]>(
    existingBlocks.length > 0 ? existingBlocks : []
  )

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name:          existing?.name ?? '',
      slug:          existing?.slug ?? '',
      description:   existing?.description ?? '',
      status:        existing?.status ?? 'draft',
      product_id:    existing?.product_id ?? '',
      submit_message: (existing?.settings?.submit_message as string) ?? 'Obrigado pelo envio!',
      redirect_url:  (existing?.settings?.redirect_url as string) ?? '',
      notify_email:  (existing?.settings?.notify_email as string) ?? '',
    },
  })

  const addBlock = (type: BlockType) => {
    setBlocks(prev => [...prev, {
      id: genId(), block_type: type, label: '',
      required: false, options: (type === 'select' || type === 'multiselect') ? [] : undefined,
    }])
  }

  const moveBlock = (index: number, dir: -1 | 1) => {
    setBlocks(prev => {
      const arr = [...prev]
      const target = index + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return arr
    })
  }

  const onSubmit = async (values: FormValues) => {
    const settings = {
      submit_message: values.submit_message,
      redirect_url:   values.redirect_url || undefined,
      notify_email:   values.notify_email || undefined,
    }
    let formId: string
    if (existing) {
      const updated = await updateForm.mutateAsync({ id: existing.id, ...values, product_id: values.product_id || null, settings })
      formId = updated.id
    } else {
      const created = await createForm.mutateAsync({ ...values, product_id: values.product_id || null, settings })
      formId = created.id
    }
    await saveBlocks.mutateAsync({ formId, blocks })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {existing ? 'Editar formulário' : 'Novo formulário'}
          </DialogTitle>
          <DialogDescription>Builder typeform-style com perguntas sequenciais.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody>
            <Tabs defaultValue="config">
              <TabsList className="mb-4">
                <TabsTrigger value="config" className="text-xs">Configuração</TabsTrigger>
                <TabsTrigger value="builder" className="text-xs">Builder ({blocks.length})</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">Configurar</TabsTrigger>
              </TabsList>

              {/* Config */}
              <TabsContent value="config" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input placeholder="Ex: Formulário de Interesse"
                      {...register('name')}
                      onChange={e => {
                        setValue('name', e.target.value)
                        if (!existing) setValue('slug', slugify(e.target.value))
                      }}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">/f/</span>
                      <Input placeholder="meu-form" {...register('slug')} className="flex-1" />
                    </div>
                  </div>
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
                    <Label>Produto</Label>
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

              {/* Builder */}
              <TabsContent value="builder" className="space-y-3 max-h-[50vh] overflow-y-auto">
                {blocks.map((block, i) => (
                  <BlockItem
                    key={block.id ?? i}
                    block={block}
                    index={i}
                    total={blocks.length}
                    onChange={updated => setBlocks(prev => prev.map((b, j) => j === i ? updated : b))}
                    onDelete={() => setBlocks(prev => prev.filter((_, j) => j !== i))}
                    onMove={dir => moveBlock(i, dir)}
                  />
                ))}

                {blocks.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Adicione campos abaixo
                  </div>
                )}

                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar campo</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BLOCK_TYPES.map(bt => (
                      <button key={bt.type} type="button"
                        onClick={() => addBlock(bt.type)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/40 hover:bg-primary/5 transition-colors">
                        <span>{bt.icon}</span> {bt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Settings */}
              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Mensagem de sucesso</Label>
                  <Input placeholder="Obrigado pelo envio!" {...register('submit_message')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Redirecionar após envio (opcional)</Label>
                  <Input placeholder="https://seusite.com/obrigado" {...register('redirect_url')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Notificar e-mail (opcional)</Label>
                  <Input placeholder="email@exemplo.com" {...register('notify_email')} />
                </div>
              </TabsContent>
            </Tabs>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting || saveBlocks.isPending}>
              {existing ? 'Salvar' : 'Criar formulário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Submissions Dialog ────────────────────────────────────────
function SubmissionsDialog({ form, onClose }: { form: Form; onClose: () => void }) {
  const { data: submissions = [], isLoading } = useFormSubmissions(form.id)
  const { data: blocks = [] } = useFormBlocks(form.id)

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Respostas — {form.name}
          </DialogTitle>
          <DialogDescription>{submissions.length} envios recebidos</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-card animate-pulse" />)}
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum envio ainda.</p>
          ) : (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto">
              {submissions.map(sub => (
                <div key={sub.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(sub.created_at).toLocaleString('pt-BR')}
                    </span>
                    {sub.utm_source && (
                      <Badge variant="muted" className="text-[10px]">{sub.utm_source}</Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    {blocks.map(block => {
                      const answer = sub.answers[block.id]
                      if (!answer) return null
                      return (
                        <div key={block.id} className="flex items-start gap-2 text-xs">
                          <span className="text-muted-foreground min-w-0 flex-1 truncate">{block.label}</span>
                          <span className="text-foreground font-medium text-right">{String(answer)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  FormsPage                                               ║
// ╚══════════════════════════════════════════════════════════╝
export function FormsPage() {
  const { data: forms = [], isLoading } = useForms()
  const deleteForm   = useDeleteForm()
  const updateForm   = useUpdateForm()

  const [builderOpen, setBuilderOpen] = useState<{ existing?: Form } | null>(null)
  const [submissionsFor, setSubmissionsFor] = useState<Form | null>(null)
  const [deleteConfirm, setDeleteConfirm]   = useState<string | null>(null)

  const copyLink = (slug: string) => navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Formulários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Formulários typeform-style para captura de leads com perguntas sequenciais.
          </p>
        </div>
        <Button onClick={() => setBuilderOpen({})}>
          <Plus className="h-4 w-4" /> Novo formulário
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />)}
        </div>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum formulário criado.</p>
            <Button size="sm" onClick={() => setBuilderOpen({})}>
              <Plus className="h-3.5 w-3.5" /> Criar formulário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map(form => {
            const statusMeta = STATUS_META[form.status]
            return (
              <Card key={form.id} className="hover:border-border/80 transition-colors">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-foreground truncate">{form.name}</span>
                      <Badge variant={statusMeta.variant} className="text-[10px]">{statusMeta.label}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">/f/{form.slug}</span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {form.status === 'active' && (
                      <>
                        <Button variant="ghost" size="icon-sm" title="Copiar link" onClick={() => copyLink(form.slug)}>
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Respostas"
                          onClick={() => setSubmissionsFor(form)}>
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon-sm" title="Visualizar"
                      onClick={() => window.open(`/f/${form.slug}`, '_blank')}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Editar"
                      onClick={() => setBuilderOpen({ existing: form })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Duplicar"
                      onClick={() => setBuilderOpen({ existing: { ...form, id: '', slug: form.slug + '-copy', status: 'draft' } })}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {form.status !== 'archived' ? (
                      <Button variant="ghost" size="icon-sm" title="Ativar/Arquivar"
                        onClick={() => updateForm.mutate({ id: form.id, status: form.status === 'active' ? 'draft' : 'active' })}>
                        {form.status === 'active'
                          ? <ToggleRight className="h-3.5 w-3.5 text-success" />
                          : <ToggleLeft className="h-3.5 w-3.5" />}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" title="Excluir"
                        onClick={() => setDeleteConfirm(form.id)}>
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

      {builderOpen !== null && (
        <FormBuilderDialog open onClose={() => setBuilderOpen(null)} existing={builderOpen.existing} />
      )}

      {submissionsFor && (
        <SubmissionsDialog form={submissionsFor} onClose={() => setSubmissionsFor(null)} />
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir formulário?</DialogTitle>
            <DialogDescription>Todas as respostas serão perdidas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" loading={deleteForm.isPending}
              onClick={async () => {
                if (deleteConfirm) { await deleteForm.mutateAsync(deleteConfirm); setDeleteConfirm(null) }
              }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

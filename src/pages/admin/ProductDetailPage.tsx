import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Plus, Pencil, Trash2, GripVertical, Trophy, XCircle,
  Package, DollarSign, Zap, ExternalLink, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  useProduct, useUpdateProduct, useUpdateStage, useCreateStage,
  useDeleteStage, useReorderStages, useCreateOffer, useDeleteOffer,
  type PipelineStage,
} from '@/hooks/useProducts'

// ── Cores para os stages ─────────────────────────────────────
const STAGE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
]

// ── Schema stage ─────────────────────────────────────────────
const stageSchema = z.object({
  name: z.string().min(1, 'Obrigatório'),
  color: z.string(),
  probability: z.number().min(0).max(100),
  is_won: z.boolean(),
  is_lost: z.boolean(),
})
type StageValues = z.infer<typeof stageSchema>

// ── Schema offer ─────────────────────────────────────────────
const offerSchema = z.object({
  name: z.string().min(1, 'Obrigatório'),
  price: z.string().min(1, 'Obrigatório'),
  payment_type: z.enum(['one_time', 'recurring', 'installment']),
  installments: z.string().optional(),
  external_url: z.string().url('URL inválida').optional().or(z.literal('')),
})
type OfferValues = z.infer<typeof offerSchema>

// ╔══════════════════════════════════════════════════════════╗
// ║  StageCard — card de estágio com edição inline           ║
// ╚══════════════════════════════════════════════════════════╝
function StageCard({
  stage, index, total, productId,
  onReorder,
}: {
  stage: PipelineStage
  index: number
  total: number
  productId: string
  onReorder: (from: number, to: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const updateStage = useUpdateStage()
  const deleteStage = useDeleteStage()

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<StageValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: stage.name,
      color: stage.color,
      probability: stage.probability,
      is_won: stage.is_won,
      is_lost: stage.is_lost,
    },
  })

  const selectedColor = watch('color')
  const isWon = watch('is_won')
  const isLost = watch('is_lost')

  const onSave = async (values: StageValues) => {
    await updateStage.mutateAsync({ id: stage.id, product_id: productId, ...values })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedColor }} />
          <Input className="h-7 text-sm" {...register('name')} autoFocus />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STAGE_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setValue('color', c)}
              className={cn('h-5 w-5 rounded-full transition-all ring-offset-1',
                selectedColor === c ? 'ring-2 ring-primary scale-110' : 'hover:scale-110')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Probabilidade (%)</Label>
            <Input type="number" min={0} max={100} className="h-7 text-sm"
              {...register('probability', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <Switch checked={isWon} onCheckedChange={v => { setValue('is_won', v); if (v) setValue('is_lost', false) }} />
              <Label className="text-xs">Ganho</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isLost} onCheckedChange={v => { setValue('is_lost', v); if (v) setValue('is_won', false) }} />
              <Label className="text-xs">Perdido</Label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => { reset(); setEditing(false) }}>Cancelar</Button>
          <Button size="sm" loading={isSubmitting} onClick={handleSubmit(onSave)}>
            <Check className="h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 hover:border-border/80 transition-colors">
      {/* Drag handle */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
        <div className="flex gap-0.5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-1 w-1 rounded-full bg-muted-foreground" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Cor + nome */}
      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: stage.color + '20' }}>
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-foreground">{stage.name}</p>
          {stage.is_won && <Badge variant="success" className="text-[10px] px-1.5 py-0">Ganho</Badge>}
          {stage.is_lost && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Perdido</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{stage.probability}% de probabilidade</p>
      </div>

      {/* Posição */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon-sm" disabled={index === 0}
          onClick={() => onReorder(index, index - 1)}>
          <GripVertical className="h-3 w-3 rotate-90 -scale-y-100" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={index === total - 1}
          onClick={() => onReorder(index, index + 1)}>
          <GripVertical className="h-3 w-3 rotate-90" />
        </Button>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm"
          onClick={() => deleteStage.mutate({ id: stage.id, product_id: productId })}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  OfferDialog                                             ║
// ╚══════════════════════════════════════════════════════════╝
function OfferDialog({ productId, open, onClose }: { productId: string; open: boolean; onClose: () => void }) {
  const createOffer = useCreateOffer()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<OfferValues>({
    resolver: zodResolver(offerSchema),
    defaultValues: { payment_type: 'one_time' },
  })
  const paymentType = watch('payment_type')

  const onSubmit = async (values: OfferValues) => {
    await createOffer.mutateAsync({
      product_id: productId,
      name: values.name,
      price: parseFloat(values.price),
      payment_type: values.payment_type,
      installments: values.installments ? parseInt(values.installments) : undefined,
      external_url: values.external_url || undefined,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova oferta</DialogTitle>
          <DialogDescription>Configure o preço e condição de pagamento desta oferta.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da oferta *</Label>
              <Input placeholder="Ex: Plano Mensal, Anual, Parcelado" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço (R$) *</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('price')} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de pagamento</Label>
                <select {...register('payment_type')}
                  className="flex h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="one_time">À vista</option>
                  <option value="recurring">Recorrente</option>
                  <option value="installment">Parcelado</option>
                </select>
              </div>
            </div>
            {paymentType === 'installment' && (
              <div className="space-y-1.5">
                <Label>Número de parcelas</Label>
                <Input type="number" min={2} max={48} placeholder="Ex: 12" {...register('installments')} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Link de pagamento (opcional)</Label>
              <Input type="url" placeholder="https://..." {...register('external_url')} />
              {errors.external_url && <p className="text-xs text-destructive">{errors.external_url.message}</p>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Criar oferta</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  ProductDetailPage                                       ║
// ╚══════════════════════════════════════════════════════════╝
export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const createStage = useCreateStage()
  const reorderStages = useReorderStages()
  const deleteOffer = useDeleteOffer()

  const [offerOpen, setOfferOpen] = useState(false)
  const [addingStage, setAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-card animate-pulse rounded-lg" />
        <div className="h-64 bg-card animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Produto não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    )
  }

  const handleReorder = (from: number, to: number) => {
    const stages = [...product.pipeline_stages]
    const [moved] = stages.splice(from, 1)
    stages.splice(to, 0, moved)
    const reordered = stages.map((s, i) => ({ id: s.id, position: i }))
    reorderStages.mutate({ product_id: product.id, stages: reordered })
  }

  const handleAddStage = async () => {
    if (!newStageName.trim()) return
    await createStage.mutateAsync({
      product_id: product.id,
      name: newStageName.trim(),
      position: product.pipeline_stages.length,
      probability: 50,
    })
    setNewStageName('')
    setAddingStage(false)
  }

  const formatPaymentType = (type: string, installments?: number | null) => {
    if (type === 'one_time') return 'À vista'
    if (type === 'recurring') return 'Recorrente'
    if (type === 'installment') return `${installments}x`
    return type
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-foreground">{product.name}</h1>
            <Badge variant={product.is_active ? 'default' : 'muted'}>
              {product.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          {product.description && <p className="text-sm text-muted-foreground mt-0.5">{product.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ativo</span>
          <Switch
            checked={product.is_active}
            onCheckedChange={v => updateProduct.mutate({ id: product.id, is_active: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {product.price != null ? `R$ ${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Preço base</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{product.pipeline_stages.length}</p>
              <p className="text-xs text-muted-foreground">Estágios no pipeline</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{product.product_offers.length}</p>
              <p className="text-xs text-muted-foreground">Ofertas cadastradas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Pipeline — col 3 */}
        <div className="col-span-3 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Pipeline de vendas</CardTitle>
                  <CardDescription className="mt-0.5">Reordene e configure cada estágio.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setAddingStage(true)}>
                  <Plus className="h-3.5 w-3.5" /> Estágio
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {/* Legenda won/lost */}
              <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-success" /> Ganho</span>
                <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> Perdido</span>
              </div>

              {product.pipeline_stages.map((stage, i) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  index={i}
                  total={product.pipeline_stages.length}
                  productId={product.id}
                  onReorder={handleReorder}
                />
              ))}

              {addingStage && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    autoFocus
                    placeholder="Nome do novo estágio"
                    value={newStageName}
                    onChange={e => setNewStageName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddStage(); if (e.key === 'Escape') setAddingStage(false) }}
                  />
                  <Button size="sm" loading={createStage.isPending} onClick={handleAddStage}>Adicionar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingStage(false)}>Cancelar</Button>
                </div>
              )}

              {product.pipeline_stages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum estágio. Clique em + Estágio.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ofertas — col 2 */}
        <div className="col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Ofertas & Preços</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setOfferOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Oferta
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {product.product_offers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma oferta.</p>
              ) : (
                product.product_offers.map(offer => (
                  <div key={offer.id} className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-border/80">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{offer.name}</p>
                        {offer.is_active ? (
                          <Badge variant="success" className="text-[10px] px-1">Ativo</Badge>
                        ) : (
                          <Badge variant="muted" className="text-[10px] px-1">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs font-semibold text-primary">
                          R$ {offer.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatPaymentType(offer.payment_type, offer.installments)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {offer.external_url && (
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a href={offer.external_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm"
                        onClick={() => deleteOffer.mutate({ id: offer.id, product_id: product.id })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <OfferDialog productId={product.id} open={offerOpen} onClose={() => setOfferOpen(false)} />
    </div>
  )
}

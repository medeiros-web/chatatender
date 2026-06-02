import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Package, Pencil, Trash2, ToggleRight, ToggleLeft,
  ChevronRight, DollarSign, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, type Product } from '@/hooks/useProducts'
import { useSectors } from '@/hooks/useSectors'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const productSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  price: z.string().optional(),
  default_sector_id: z.string().optional(),
})
type ProductValues = z.infer<typeof productSchema>

function ProductFormDialog({
  open, onClose, product,
}: {
  open: boolean
  onClose: () => void
  product?: Product
}) {
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const { data: sectors = [] } = useSectors()

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price != null ? String(product.price) : '',
      default_sector_id: product?.default_sector_id ?? '',
    },
  })

  const sectorId = watch('default_sector_id')

  const onSubmit = async (values: ProductValues) => {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      price: values.price ? parseFloat(values.price) : undefined,
      default_sector_id: values.default_sector_id || null,
    }
    if (product) {
      await updateProduct.mutateAsync({ id: product.id, ...payload })
    } else {
      await createProduct.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Novo produto'}</DialogTitle>
          <DialogDescription>
            O pipeline de estágios é criado automaticamente com 6 etapas padrão.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do produto *</Label>
              <Input placeholder="Ex: Consultoria Premium, Plano Mensal" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Breve descrição do produto ou serviço" {...register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('price')} />
              </div>
              <div className="space-y-1.5">
                <Label>Setor padrão</Label>
                <Select value={sectorId} onValueChange={v => setValue('default_sector_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {sectors.filter(s => s.is_active).map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>
              {product ? 'Salvar' : 'Criar produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProductsPage() {
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useProducts()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const activeProducts = products.filter(p => p.is_active)
  const totalRevenue = products.reduce((acc, p) => acc + (p.price ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cada produto tem seu próprio pipeline de vendas com estágios configuráveis.
          </p>
        </div>
        <Button onClick={() => { setEditProduct(undefined); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de produtos', value: products.length, icon: Package },
          { label: 'Ativos', value: activeProducts.length, icon: ToggleRight },
          { label: 'Ticket médio', value: `R$ ${totalRevenue > 0 ? (totalRevenue / products.filter(p => p.price).length || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}`, icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Package className="h-7 w-7 text-primary" />
            </div>
            <p className="font-medium text-foreground">Nenhum produto ainda</p>
            <p className="text-sm text-muted-foreground">Crie o primeiro produto e seu pipeline será gerado automaticamente.</p>
            <Button onClick={() => setFormOpen(true)} className="mt-2">
              <Plus className="h-4 w-4" /> Criar primeiro produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {products.map(product => (
            <Card key={product.id} className="hover:border-border/80 transition-colors group cursor-pointer"
              onClick={() => navigate(`/admin/products/${product.id}`)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{product.name}</p>
                    {!product.is_active && <Badge variant="muted">Inativo</Badge>}
                  </div>
                  {product.description && (
                    <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {product.price != null && (
                      <span className="text-xs text-muted-foreground">
                        R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" /> 6 estágios
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-sm" title={product.is_active ? 'Desativar' : 'Ativar'}
                    onClick={() => updateProduct.mutate({ id: product.id, is_active: !product.is_active })}>
                    {product.is_active
                      ? <ToggleRight className="h-4 w-4 text-success" />
                      : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon-sm"
                    onClick={() => { setEditProduct(product); setFormOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm"
                    onClick={() => setDeleteConfirm(product.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProductFormDialog open={formOpen} onClose={() => setFormOpen(false)} product={editProduct} />

      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir produto?</DialogTitle>
            <DialogDescription>Todos os estágios e dados associados serão removidos. Esta ação é irreversível.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" loading={deleteProduct.isPending}
              onClick={async () => { if (deleteConfirm) { await deleteProduct.mutateAsync(deleteConfirm); setDeleteConfirm(null) } }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

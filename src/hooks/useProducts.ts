import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface Product {
  id: string
  organization_id: string
  name: string
  description: string | null
  price: number | null
  currency: string
  image_url: string | null
  is_active: boolean
  default_sector_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProductWithStages extends Product {
  pipeline_stages: PipelineStage[]
  product_offers: ProductOffer[]
  product_ctas: ProductCta[]
}

export interface PipelineStage {
  id: string
  organization_id: string
  product_id: string
  name: string
  description: string | null
  color: string
  position: number
  is_won: boolean
  is_lost: boolean
  probability: number
  created_at: string
  updated_at: string
}

export interface CustomField {
  id: string
  organization_id: string
  product_id: string | null
  name: string
  label: string
  field_type: string
  options: unknown
  is_required: boolean
  is_active: boolean
  position: number
  created_at: string
}

export interface ProductOffer {
  id: string
  organization_id: string
  product_id: string
  name: string
  description: string | null
  price: number
  currency: string
  payment_type: string
  installments: number | null
  is_active: boolean
  external_url: string | null
  created_at: string
  updated_at: string
}

export interface ProductCta {
  id: string
  organization_id: string
  product_id: string
  label: string
  url: string | null
  cta_type: string
  is_primary: boolean
  position: number
  created_at: string
}

// ── Products ──────────────────────────────────────────────────
export function useProducts() {
  const { organizationId } = useAuth()
  return useQuery<Product[]>({
    queryKey: ['products', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db
        .from('products').select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Product[]
    },
    enabled: !!organizationId,
  })
}

export function useProduct(productId: string | undefined) {
  return useQuery<ProductWithStages | null>({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) return null
      const { data, error } = await db
        .from('products')
        .select(`*, pipeline_stages(*), product_offers(*), product_ctas(*)`)
        .eq('id', productId)
        .single()
      if (error) throw error
      const p = data as ProductWithStages
      p.pipeline_stages = (p.pipeline_stages ?? []).sort((a: PipelineStage, b: PipelineStage) => a.position - b.position)
      p.product_ctas = (p.product_ctas ?? []).sort((a: ProductCta, b: ProductCta) => a.position - b.position)
      return p
    },
    enabled: !!productId,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()
  return useMutation({
    mutationFn: async (values: { name: string; description?: string; price?: number; default_sector_id?: string | null }) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('products')
        .insert({ ...values, organization_id: organizationId, created_by: user?.id })
        .select().single()
      if (error) throw error
      return data as Product
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', organizationId] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Product> & { id: string }) => {
      const { data, error } = await db.from('products').update(values).eq('id', id).select().single()
      if (error) throw error
      return data as Product
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['products', organizationId] })
      qc.invalidateQueries({ queryKey: ['product', vars.id] })
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', organizationId] }),
  })
}

// ── Pipeline Stages ───────────────────────────────────────────
export function usePipelineStages(productId: string | undefined) {
  return useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages', productId],
    queryFn: async () => {
      if (!productId) return []
      const { data, error } = await db.from('pipeline_stages')
        .select('*').eq('product_id', productId).order('position')
      if (error) throw error
      return data as PipelineStage[]
    },
    enabled: !!productId,
  })
}

export function useCreateStage() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: { product_id: string; name: string; color?: string; position?: number; probability?: number; is_won?: boolean; is_lost?: boolean }) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('pipeline_stages')
        .insert({ ...values, organization_id: organizationId }).select().single()
      if (error) throw error
      return data as PipelineStage
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages', vars.product_id] })
      qc.invalidateQueries({ queryKey: ['product', vars.product_id] })
    },
  })
}

export function useUpdateStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, product_id, ...values }: Partial<PipelineStage> & { id: string; product_id: string }) => {
      const { data, error } = await db.from('pipeline_stages').update(values).eq('id', id).select().single()
      if (error) throw error
      return { data: data as PipelineStage, product_id }
    },
    onSuccess: ({ product_id }) => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages', product_id] })
      qc.invalidateQueries({ queryKey: ['product', product_id] })
    },
  })
}

export function useDeleteStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, product_id }: { id: string; product_id: string }) => {
      const { error } = await db.from('pipeline_stages').delete().eq('id', id)
      if (error) throw error
      return product_id
    },
    onSuccess: (product_id: string) => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages', product_id] })
      qc.invalidateQueries({ queryKey: ['product', product_id] })
    },
  })
}

export function useReorderStages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ product_id, stages }: { product_id: string; stages: { id: string; position: number }[] }) => {
      await Promise.all(
        stages.map(s => db.from('pipeline_stages').update({ position: s.position }).eq('id', s.id))
      )
      return product_id
    },
    onSuccess: (product_id: string) => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages', product_id] })
      qc.invalidateQueries({ queryKey: ['product', product_id] })
    },
  })
}

// ── Custom Fields ─────────────────────────────────────────────
export function useCustomFields(productId?: string) {
  const { organizationId } = useAuth()
  return useQuery<CustomField[]>({
    queryKey: ['custom-fields', organizationId, productId],
    queryFn: async () => {
      if (!organizationId) return []
      let q = db.from('custom_fields').select('*').eq('organization_id', organizationId)
      if (productId) q = q.or(`product_id.eq.${productId},product_id.is.null`)
      else q = q.is('product_id', null)
      const { data, error } = await q.order('position')
      if (error) throw error
      return data as CustomField[]
    },
    enabled: !!organizationId,
  })
}

// ── Product Offers ────────────────────────────────────────────
export function useProductOffers(productId: string | undefined) {
  return useQuery<ProductOffer[]>({
    queryKey: ['product-offers', productId],
    queryFn: async () => {
      if (!productId) return []
      const { data, error } = await db.from('product_offers').select('*').eq('product_id', productId)
      if (error) throw error
      return data as ProductOffer[]
    },
    enabled: !!productId,
  })
}

export function useCreateOffer() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: { product_id: string; name: string; price: number; payment_type?: string; installments?: number; external_url?: string }) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('product_offers')
        .insert({ ...values, organization_id: organizationId }).select().single()
      if (error) throw error
      return data as ProductOffer
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['product-offers', vars.product_id] }),
  })
}

export function useDeleteOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, product_id }: { id: string; product_id: string }) => {
      const { error } = await db.from('product_offers').delete().eq('id', id)
      if (error) throw error
      return product_id
    },
    onSuccess: (product_id: string) => qc.invalidateQueries({ queryKey: ['product-offers', product_id] }),
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type FormStatus = 'draft' | 'active' | 'archived'
export type BlockType =
  | 'short_text' | 'long_text' | 'email' | 'phone' | 'select'
  | 'multiselect' | 'date' | 'rating' | 'file' | 'statement' | 'redirect'

export interface FormBlock {
  id: string
  form_id: string
  organization_id: string
  block_type: BlockType
  label: string
  description: string | null
  placeholder: string | null
  required: boolean
  options: { label: string; value: string }[] | null
  settings: Record<string, unknown> | null
  position: number
}

export interface Form {
  id: string
  organization_id: string
  product_id: string | null
  name: string
  slug: string
  description: string | null
  status: FormStatus
  settings: {
    redirect_url?: string
    submit_message?: string
    collect_email?: boolean
    require_phone?: boolean
    notify_email?: string
    bg_color?: string
    accent_color?: string
    logo_url?: string
  }
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  form_id: string
  organization_id: string
  lead_id: string | null
  session_id: string | null
  answers: Record<string, unknown>
  utm_source: string | null
  created_at: string
}

// ── Forms ──────────────────────────────────────────────────────
export function useForms() {
  const { organizationId } = useAuth()
  return useQuery<Form[]>({
    queryKey: ['forms', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db.from('forms').select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!organizationId,
  })
}

export function useForm(id: string | undefined) {
  const { organizationId } = useAuth()
  return useQuery<Form | null>({
    queryKey: ['form', id, organizationId],
    queryFn: async () => {
      if (!id || !organizationId) return null
      const { data } = await db.from('forms').select('*')
        .eq('id', id).eq('organization_id', organizationId).single()
      return data ?? null
    },
    enabled: !!id && !!organizationId,
  })
}

export function useFormBySlug(slug: string | undefined) {
  return useQuery<{ form: Form; blocks: FormBlock[] } | null>({
    queryKey: ['form-public', slug],
    queryFn: async () => {
      if (!slug) return null
      const { data: form } = await db.from('forms').select('*')
        .eq('slug', slug).eq('status', 'active').single()
      if (!form) return null
      const { data: blocks } = await db.from('form_blocks').select('*')
        .eq('form_id', form.id).order('position', { ascending: true })
      return { form: form as Form, blocks: (blocks ?? []) as FormBlock[] }
    },
    enabled: !!slug,
  })
}

export function useCreateForm() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<Form>) => {
      if (!organizationId) throw new Error('No org')
      const { data, error } = await db.from('forms')
        .insert({ ...values, organization_id: organizationId })
        .select().single()
      if (error) throw error
      return data as Form
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', organizationId] }),
  })
}

export function useUpdateForm() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Form> & { id: string }) => {
      const { data, error } = await db.from('forms')
        .update(values).eq('id', id).eq('organization_id', organizationId).select().single()
      if (error) throw error
      return data as Form
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['forms', organizationId] })
      qc.invalidateQueries({ queryKey: ['form', data.id, organizationId] })
    },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('forms')
        .delete().eq('id', id).eq('organization_id', organizationId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', organizationId] }),
  })
}

// ── Form Blocks ────────────────────────────────────────────────
export function useFormBlocks(formId: string | undefined) {
  const { organizationId } = useAuth()
  return useQuery<FormBlock[]>({
    queryKey: ['form-blocks', formId, organizationId],
    queryFn: async () => {
      if (!formId || !organizationId) return []
      const { data } = await db.from('form_blocks').select('*')
        .eq('form_id', formId).eq('organization_id', organizationId)
        .order('position', { ascending: true })
      return data ?? []
    },
    enabled: !!formId && !!organizationId,
  })
}

export function useSaveFormBlocks() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async ({ formId, blocks }: { formId: string; blocks: Partial<FormBlock>[] }) => {
      if (!organizationId) throw new Error('No org')
      await db.from('form_blocks').delete().eq('form_id', formId).eq('organization_id', organizationId)
      if (blocks.length === 0) return
      const { error } = await db.from('form_blocks').insert(
        blocks.map((b, i) => ({ ...b, form_id: formId, organization_id: organizationId, position: i }))
      )
      if (error) throw error
    },
    onSuccess: (_, { formId }) => {
      qc.invalidateQueries({ queryKey: ['form-blocks', formId, organizationId] })
    },
  })
}

// ── Submissions ────────────────────────────────────────────────
export function useFormSubmissions(formId: string | undefined) {
  const { organizationId } = useAuth()
  return useQuery<FormSubmission[]>({
    queryKey: ['form-submissions', formId, organizationId],
    queryFn: async () => {
      if (!formId || !organizationId) return []
      const { data } = await db.from('form_submissions').select('*')
        .eq('form_id', formId).eq('organization_id', organizationId)
        .order('created_at', { ascending: false }).limit(100)
      return data ?? []
    },
    enabled: !!formId && !!organizationId,
  })
}

export async function submitForm(params: {
  formId: string
  organizationId: string
  answers: Record<string, unknown>
  utms?: Record<string, string>
  sessionId?: string
}): Promise<{ ok: boolean; lead_id?: string }> {
  // Cria/atualiza lead a partir do email/phone nas respostas
  const email = Object.values(params.answers).find(v => typeof v === 'string' && v.includes('@')) as string | undefined
  const phone = Object.values(params.answers).find(v => typeof v === 'string' && /^\+?[\d\s()-]{8,}$/.test(v as string)) as string | undefined

  let leadId: string | undefined
  if (email || phone) {
    const query = db.from('leads').select('id')
      .eq('organization_id', params.organizationId)
    if (email) query.eq('email', email)
    else if (phone) query.eq('phone', phone)
    const { data: existing } = await query.single()
    if (existing) {
      leadId = (existing as { id: string }).id
    } else {
      const { data: created } = await db.from('leads').insert({
        organization_id: params.organizationId,
        email: email ?? null,
        phone: phone ?? null,
        name: (params.answers['name'] as string) ?? email ?? phone ?? 'Lead',
        source: 'form',
        utm_source: params.utms?.utm_source ?? null,
        utm_medium: params.utms?.utm_medium ?? null,
        utm_campaign: params.utms?.utm_campaign ?? null,
      }).select('id').single()
      leadId = (created as { id: string } | null)?.id
    }
  }

  await db.from('form_submissions').insert({
    form_id: params.formId,
    organization_id: params.organizationId,
    lead_id: leadId ?? null,
    session_id: params.sessionId ?? null,
    answers: params.answers,
    utm_source:   params.utms?.utm_source ?? null,
    utm_medium:   params.utms?.utm_medium ?? null,
    utm_campaign: params.utms?.utm_campaign ?? null,
    utm_content:  params.utms?.utm_content ?? null,
    utm_term:     params.utms?.utm_term ?? null,
    referrer:     typeof window !== 'undefined' ? document.referrer : null,
  })

  return { ok: true, lead_id: leadId }
}

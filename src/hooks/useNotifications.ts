import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const db = supabase as any

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  organization_id: string
  user_id: string
  type: string
  title: string
  body: string | null
  meta: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export interface EmailTemplate {
  id: string
  organization_id: string
  name: string
  subject: string
  html_body: string
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailSendLog {
  id: string
  organization_id: string | null
  template_id: string | null
  campaign_id: string | null
  to_email: string
  to_name: string | null
  subject: string
  status: 'queued' | 'sent' | 'failed' | 'bounced'
  resend_id: string | null
  error_message: string | null
  process_after: string
  sent_at: string | null
  created_at: string
}

export interface MassCampaign {
  id: string
  organization_id: string
  name: string
  template_id: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  scheduled_at: string | null
  sent_at: string | null
  total_recipients: number
  sent_count: number
  failed_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  email_templates?: { name: string } | null
}

export interface UserNotifSettings {
  id: string
  user_id: string
  email_on_lead_assigned: boolean
  email_on_message: boolean
  email_on_mention: boolean
  email_on_deal_won: boolean
  sound_enabled: boolean
  sound_url: string | null
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function useNotifications() {
  const { user } = useAuth()
  return useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await db
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []) as Notification[]
    },
  })
}

export function useUnreadCount() {
  const { user } = useAuth()
  return useQuery<number>({
    queryKey: ['notifications_unread', user?.id],
    enabled: !!user?.id,
    staleTime: 10_000,
    queryFn: async () => {
      const { count } = await db
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
      return count ?? 0
    },
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      await db.from('notifications').update({ is_read: true }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
      qc.invalidateQueries({ queryKey: ['notifications_unread', user?.id] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
      qc.invalidateQueries({ queryKey: ['notifications_unread', user?.id] })
    },
  })
}

// ── Realtime subscription ─────────────────────────────────────────────────────

export function useRealtimeNotifications(onNew?: (n: Notification) => void) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const cbRef = useRef(onNew)
  cbRef.current = onNew

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ['notifications', user.id] })
          qc.invalidateQueries({ queryKey: ['notifications_unread', user.id] })
          if (cbRef.current) cbRef.current(payload.new as Notification)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, qc])
}

// ── User notification settings ────────────────────────────────────────────────

export function useNotifSettings() {
  const { user } = useAuth()
  return useQuery<UserNotifSettings | null>({
    queryKey: ['notif_settings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await db
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      return (data as UserNotifSettings | null) ?? null
    },
  })
}

export function useUpsertNotifSettings() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<UserNotifSettings>) => {
      const { error } = await db
        .from('user_notification_settings')
        .upsert({ ...values, user_id: user!.id }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notif_settings', user?.id] }),
  })
}

// ── Email Templates ───────────────────────────────────────────────────────────

export function useEmailTemplates() {
  const { organizationId } = useAuth()
  return useQuery<EmailTemplate[]>({
    queryKey: ['email_templates', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await db
        .from('email_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      return (data ?? []) as EmailTemplate[]
    },
  })
}

export function useUpsertEmailTemplate() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<EmailTemplate> & { name: string; subject: string; html_body: string }) => {
      const payload = { ...values, organization_id: organizationId }
      const { error } = values.id
        ? await db.from('email_templates').update(payload).eq('id', values.id)
        : await db.from('email_templates').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email_templates', organizationId] }),
  })
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('email_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email_templates', organizationId] }),
  })
}

// ── Email Send Log ────────────────────────────────────────────────────────────

export function useEmailSendLog() {
  const { organizationId } = useAuth()
  return useQuery<EmailSendLog[]>({
    queryKey: ['email_send_log', organizationId],
    enabled: !!organizationId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await db
        .from('email_send_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100)
      return (data ?? []) as EmailSendLog[]
    },
  })
}

// ── Mass Campaigns ────────────────────────────────────────────────────────────

export function useMassCampaigns() {
  const { organizationId } = useAuth()
  return useQuery<MassCampaign[]>({
    queryKey: ['mass_campaigns', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await db
        .from('mass_email_campaigns')
        .select('*, email_templates(name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      return (data ?? []) as MassCampaign[]
    },
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()
  return useMutation({
    mutationFn: async (values: { name: string; template_id?: string; scheduled_at?: string }) => {
      const { error } = await db.from('mass_email_campaigns').insert({
        ...values,
        organization_id: organizationId,
        created_by: user!.id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mass_campaigns', organizationId] }),
  })
}

export function useUpdateCampaign() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<MassCampaign> & { id: string }) => {
      const { error } = await db.from('mass_email_campaigns').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mass_campaigns', organizationId] }),
  })
}

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type ConversationStatus = 'open' | 'waiting_human' | 'in_progress' | 'closed' | 'spam'
export type ConversationChannel = 'webchat' | 'whatsapp' | 'instagram' | 'facebook' | 'telegram' | 'email' | 'sms'
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'template' | 'interactive' | 'system'

export interface Conversation {
  id: string
  organization_id: string
  sector_id: string | null
  product_id: string | null
  lead_id: string | null
  widget_id: string | null
  assigned_user_id: string | null
  current_agent_id: string | null
  status: ConversationStatus
  channel: ConversationChannel
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_avatar_url: string | null
  contact_external_id: string | null
  subject: string | null
  tags: string[] | null
  custom_data: Record<string, unknown> | null
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  closed_at: string | null
  protocol: string | null
  created_at: string
  updated_at: string
  // relações
  sectors?: { name: string; color: string } | null
  profiles_assigned?: { full_name: string | null; avatar_url: string | null } | null
}

export interface Message {
  id: string
  conversation_id: string
  organization_id: string
  sender_user_id: string | null
  sender_agent_id: string | null
  is_from_contact: boolean
  message_type: MessageType
  direction: 'inbound' | 'outbound'
  content: string | null
  media_url: string | null
  media_mime_type: string | null
  media_filename: string | null
  media_size: number | null
  is_sent: boolean
  is_delivered: boolean
  is_read: boolean
  sent_at: string | null
  external_id: string | null
  metadata: Record<string, unknown> | null
  is_deleted: boolean
  created_at: string
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

export interface ConvFilters {
  status?: ConversationStatus | 'all'
  channel?: ConversationChannel | 'all'
  sectorId?: string
  assignedTo?: string
  search?: string
  unassigned?: boolean
}

// ── Conversations ─────────────────────────────────────────────
export function useConversations(filters: ConvFilters = {}) {
  const { organizationId } = useAuth()

  return useQuery<Conversation[]>({
    queryKey: ['conversations', organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return []

      let q = db.from('webchat_conversations')
        .select(`
          *,
          sectors(name, color),
          profiles_assigned:profiles!webchat_conversations_assigned_user_id_fkey(full_name, avatar_url)
        `)
        .eq('organization_id', organizationId)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
      if (filters.channel && filters.channel !== 'all') q = q.eq('channel', filters.channel)
      if (filters.sectorId) q = q.eq('sector_id', filters.sectorId)
      if (filters.assignedTo) q = q.eq('assigned_user_id', filters.assignedTo)
      if (filters.unassigned) q = q.is('assigned_user_id', null).is('current_agent_id', null)
      if (filters.search) {
        q = q.or(`contact_name.ilike.%${filters.search}%,contact_phone.ilike.%${filters.search}%,contact_email.ilike.%${filters.search}%,protocol.ilike.%${filters.search}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Conversation[]
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // fallback poll em 30s
  })
}

export function useConversation(convId: string | undefined) {
  return useQuery<Conversation | null>({
    queryKey: ['conversation', convId],
    queryFn: async () => {
      if (!convId) return null
      const { data, error } = await db.from('webchat_conversations')
        .select(`*, sectors(name, color), profiles_assigned:profiles!webchat_conversations_assigned_user_id_fkey(full_name, avatar_url)`)
        .eq('id', convId).single()
      if (error) throw error
      return data as Conversation
    },
    enabled: !!convId,
  })
}

// ── Messages ──────────────────────────────────────────────────
export function useMessages(convId: string | undefined) {
  return useQuery<Message[]>({
    queryKey: ['messages', convId],
    queryFn: async () => {
      if (!convId) return []
      const { data, error } = await db.from('webchat_messages')
        .select('*, profiles:profiles!webchat_messages_sender_user_id_fkey(full_name, avatar_url)')
        .eq('conversation_id', convId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Message[]
    },
    enabled: !!convId,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()

  return useMutation({
    mutationFn: async ({
      conversationId, content, messageType = 'text',
    }: { conversationId: string; content: string; messageType?: MessageType }) => {
      const { data, error } = await db.from('webchat_messages').insert({
        conversation_id: conversationId,
        organization_id: organizationId,
        sender_user_id: user?.id,
        is_from_contact: false,
        message_type: messageType,
        direction: 'outbound',
        content,
        is_sent: true,
        sent_at: new Date().toISOString(),
      }).select().single()
      if (error) throw error
      return data as Message
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', vars.conversationId] })
      qc.invalidateQueries({ queryKey: ['conversations', organizationId] })
    },
  })
}

// ── Conversation Actions ───────────────────────────────────────
export function useAcceptConversation() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()

  return useMutation({
    mutationFn: async ({ convId, sectorId }: { convId: string; sectorId: string }) => {
      const { error } = await db.from('webchat_conversations')
        .update({
          assigned_user_id: user?.id,
          status: 'in_progress',
          sector_id: sectorId,
          current_agent_id: null, // enforce_single_attendant vai garantir, mas é explícito
        })
        .eq('id', convId)
      if (error) throw error
      // Mensagem de sistema
      await db.from('webchat_messages').insert({
        conversation_id: convId,
        organization_id: organizationId,
        sender_user_id: user?.id,
        is_from_contact: false,
        message_type: 'system',
        direction: 'outbound',
        content: `Atendimento iniciado`,
        is_sent: true,
      })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations', organizationId] })
      qc.invalidateQueries({ queryKey: ['conversation', vars.convId] })
      qc.invalidateQueries({ queryKey: ['messages', vars.convId] })
    },
  })
}

export function useCloseConversation() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()

  return useMutation({
    mutationFn: async ({ convId, reason }: { convId: string; reason?: string }) => {
      const { error } = await db.from('webchat_conversations')
        .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user?.id })
        .eq('id', convId)
      if (error) throw error
      await db.from('webchat_messages').insert({
        conversation_id: convId,
        organization_id: organizationId,
        sender_user_id: user?.id,
        is_from_contact: false,
        message_type: 'system',
        direction: 'outbound',
        content: reason ? `Conversa encerrada: ${reason}` : 'Conversa encerrada',
        is_sent: true,
      })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations', organizationId] })
      qc.invalidateQueries({ queryKey: ['conversation', vars.convId] })
      qc.invalidateQueries({ queryKey: ['messages', vars.convId] })
    },
  })
}

export function useTransferConversation() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()

  return useMutation({
    mutationFn: async ({
      convId, toUserId, toSectorId, reason,
    }: { convId: string; toUserId?: string; toSectorId?: string; reason?: string }) => {
      const currentConv = await db.from('webchat_conversations').select('assigned_user_id, sector_id').eq('id', convId).single()

      const { error } = await db.from('webchat_conversations')
        .update({
          assigned_user_id: toUserId ?? null,
          sector_id: toSectorId ?? currentConv.data?.sector_id,
          status: toUserId ? 'in_progress' : 'waiting_human',
        })
        .eq('id', convId)
      if (error) throw error

      await db.from('conversation_transfers').insert({
        conversation_id: convId,
        organization_id: organizationId,
        from_user_id: user?.id,
        to_user_id: toUserId ?? null,
        to_sector_id: toSectorId ?? null,
        transferred_by: user?.id,
        reason,
      })

      await db.from('webchat_messages').insert({
        conversation_id: convId,
        organization_id: organizationId,
        sender_user_id: user?.id,
        is_from_contact: false,
        message_type: 'system',
        direction: 'outbound',
        content: `Conversa transferida${reason ? ': ' + reason : ''}`,
        is_sent: true,
      })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations', organizationId] })
      qc.invalidateQueries({ queryKey: ['conversation', vars.convId] })
      qc.invalidateQueries({ queryKey: ['messages', vars.convId] })
    },
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (convId: string) => {
      await db.from('webchat_conversations').update({ unread_count: 0 }).eq('id', convId)
      await db.from('webchat_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', convId)
        .eq('is_from_contact', true)
        .eq('is_read', false)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', organizationId] }),
  })
}

// ── Realtime ──────────────────────────────────────────────────
export function useConversationsRealtime(organizationId: string | null, onUpdate: () => void) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!organizationId) return

    const channel = supabase
      .channel(`conversations:${organizationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'webchat_conversations',
        filter: `organization_id=eq.${organizationId}`,
      }, onUpdate)
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [organizationId, onUpdate])
}

export function useMessagesRealtime(convId: string | undefined, onMessage: (msg: Message) => void) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!convId) return

    const channel = supabase
      .channel(`messages:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'webchat_messages',
        filter: `conversation_id=eq.${convId}`,
      }, payload => onMessage(payload.new as Message))
      .subscribe()

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [convId, onMessage])
}

// ── Widgets ───────────────────────────────────────────────────
export interface Widget {
  id: string
  organization_id: string
  sector_id: string | null
  name: string
  token: string
  is_active: boolean
  primary_color: string
  welcome_message: string
  placeholder_text: string
  avatar_url: string | null
  agent_name: string
  offline_message: string
  position: string
  created_at: string
  updated_at: string
}

export function useWidgets() {
  const { organizationId } = useAuth()
  return useQuery<Widget[]>({
    queryKey: ['widgets', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db.from('webchat_widgets').select('*').eq('organization_id', organizationId)
      if (error) throw error
      return data as Widget[]
    },
    enabled: !!organizationId,
  })
}

export function useCreateWidget() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()
  return useMutation({
    mutationFn: async (values: Partial<Widget> & { name: string }) => {
      const { data, error } = await db.from('webchat_widgets')
        .insert({ ...values, organization_id: organizationId }).select().single()
      if (error) throw error
      return data as Widget
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['widgets', organizationId] }),
  })
}

// ── Conversation Notes ────────────────────────────────────────
export interface ConvNote {
  id: string
  conversation_id: string
  user_id: string | null
  content: string
  created_at: string
  profiles?: { full_name: string | null } | null
}

export function useConvNotes(convId: string | undefined) {
  return useQuery<ConvNote[]>({
    queryKey: ['conv-notes', convId],
    queryFn: async () => {
      if (!convId) return []
      const { data, error } = await db.from('conversation_notes')
        .select('*, profiles(full_name)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ConvNote[]
    },
    enabled: !!convId,
  })
}

export function useCreateConvNote() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()
  return useMutation({
    mutationFn: async ({ convId, content }: { convId: string; content: string }) => {
      const { error } = await db.from('conversation_notes').insert({
        conversation_id: convId,
        organization_id: organizationId,
        user_id: user?.id,
        content,
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['conv-notes', vars.convId] }),
  })
}

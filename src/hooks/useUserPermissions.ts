import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type PermissionKey =
  | 'can_view_own_conversations'
  | 'can_view_queue'
  | 'can_view_other_users'
  | 'can_view_other_queues'
  | 'can_view_unassigned'
  | 'can_accept_conversations'
  | 'can_transfer_conversations'
  | 'can_close_conversations'
  | 'can_view_all_leads'
  | 'can_edit_leads'
  | 'can_delete_leads'
  | 'can_export_leads'
  | 'can_view_reports'
  | 'can_view_team_reports'
  | 'can_manage_team'
  | 'can_manage_settings'

export type UserPermissions = Record<PermissionKey, boolean> & {
  id: string
  user_id: string
  organization_id: string
  created_at: string
  updated_at: string
}

export const PERMISSION_GROUPS: {
  label: string
  permissions: { key: PermissionKey; label: string }[]
}[] = [
  {
    label: 'Conversas / Inbox',
    permissions: [
      { key: 'can_view_own_conversations', label: 'Ver próprias conversas' },
      { key: 'can_view_queue', label: 'Ver fila do setor' },
      { key: 'can_view_other_users', label: 'Ver conversas de outros agentes' },
      { key: 'can_view_other_queues', label: 'Ver outras filas' },
      { key: 'can_view_unassigned', label: 'Ver conversas sem atribuição' },
      { key: 'can_accept_conversations', label: 'Aceitar conversas' },
      { key: 'can_transfer_conversations', label: 'Transferir conversas' },
      { key: 'can_close_conversations', label: 'Fechar conversas' },
    ],
  },
  {
    label: 'Leads & CRM',
    permissions: [
      { key: 'can_view_all_leads', label: 'Ver todos os leads' },
      { key: 'can_edit_leads', label: 'Editar leads' },
      { key: 'can_delete_leads', label: 'Excluir leads' },
      { key: 'can_export_leads', label: 'Exportar leads' },
    ],
  },
  {
    label: 'Relatórios',
    permissions: [
      { key: 'can_view_reports', label: 'Ver relatórios próprios' },
      { key: 'can_view_team_reports', label: 'Ver relatórios da equipe' },
    ],
  },
  {
    label: 'Administração',
    permissions: [
      { key: 'can_manage_team', label: 'Gerenciar equipe' },
      { key: 'can_manage_settings', label: 'Alterar configurações' },
    ],
  },
]

export function useUserPermissions(userId?: string) {
  const { user } = useAuth()
  const targetId = userId ?? user?.id

  return useQuery<UserPermissions | null>({
    queryKey: ['permissions', targetId],
    queryFn: async () => {
      if (!targetId) return null
      const { data, error } = await db
        .from('user_permissions')
        .select('*')
        .eq('user_id', targetId)
        .single()
      if (error) return null
      return data as UserPermissions
    },
    enabled: !!targetId,
  })
}

export function useUpdateUserPermissions(userId: string) {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async (perms: Partial<Record<PermissionKey, boolean>>) => {
      const { error } = await db
        .from('user_permissions')
        .update(perms)
        .eq('user_id', userId)
        .eq('organization_id', organizationId ?? '')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions', userId] }),
  })
}

export function useAllOrgPermissions() {
  const { organizationId } = useAuth()

  return useQuery<UserPermissions[]>({
    queryKey: ['all-permissions', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db
        .from('user_permissions')
        .select('*')
        .eq('organization_id', organizationId)
      if (error) throw error
      return data as UserPermissions[]
    },
    enabled: !!organizationId,
  })
}

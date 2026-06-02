import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface TeamMember {
  id: string
  user_id: string
  organization_id: string
  full_name: string | null
  avatar_url: string | null
  job_title: string | null
  role: string | null
  sector_id: string | null
  is_supervisor: boolean
}

export function useOrgMembers() {
  const { organizationId } = useAuth()

  return useQuery<TeamMember[]>({
    queryKey: ['org-members', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db
        .from('profiles')
        .select(`id, organization_id, full_name, avatar_url, job_title, user_roles(role)`)
        .eq('organization_id', organizationId)
      if (error) throw error
      return (data as Array<{
        id: string
        organization_id: string
        full_name: string | null
        avatar_url: string | null
        job_title: string | null
        user_roles: { role: string }[]
      }>).map(m => ({
        id: m.id,
        user_id: m.id,
        organization_id: m.organization_id,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        job_title: m.job_title,
        role: m.user_roles?.[0]?.role ?? null,
        sector_id: null,
        is_supervisor: false,
      }))
    },
    enabled: !!organizationId,
  })
}

export function useAddSectorMember() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async ({
      sectorId, userId, isSupervisor = false,
    }: { sectorId: string; userId: string; isSupervisor?: boolean }) => {
      if (!organizationId) throw new Error('No org')
      const { error } = await db.from('sector_members').insert({
        sector_id: sectorId,
        user_id: userId,
        organization_id: organizationId,
        is_supervisor: isSupervisor,
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sector', vars.sectorId] })
      qc.invalidateQueries({ queryKey: ['sectors', organizationId] })
    },
  })
}

export function useRemoveSectorMember() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async ({ memberId, sectorId }: { memberId: string; sectorId: string }) => {
      const { error } = await db.from('sector_members').delete().eq('id', memberId)
      if (error) throw error
      return sectorId
    },
    onSuccess: (sectorId: string) => {
      qc.invalidateQueries({ queryKey: ['sector', sectorId] })
      qc.invalidateQueries({ queryKey: ['sectors', organizationId] })
    },
  })
}

export function useToggleSupervisor() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      memberId, sectorId, isSupervisor,
    }: { memberId: string; sectorId: string; isSupervisor: boolean }) => {
      const { error } = await db.from('sector_members')
        .update({ is_supervisor: isSupervisor })
        .eq('id', memberId)
      if (error) throw error
      return sectorId
    },
    onSuccess: (sectorId: string) => qc.invalidateQueries({ queryKey: ['sector', sectorId] }),
  })
}

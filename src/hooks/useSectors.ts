import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export interface Sector {
  id: string
  organization_id: string
  name: string
  description: string | null
  color: string
  icon: string
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SectorWithMembers extends Sector {
  sector_members: {
    id: string
    user_id: string
    is_supervisor: boolean
    profiles: {
      full_name: string | null
      avatar_url: string | null
      job_title: string | null
    } | null
  }[]
}

// Alias to avoid typed-client "never" issues on insert/update
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function useSectors() {
  const { organizationId } = useAuth()

  return useQuery<Sector[]>({
    queryKey: ['sectors', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      const { data, error } = await db
        .from('sectors')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name')
      if (error) throw error
      return data as Sector[]
    },
    enabled: !!organizationId,
  })
}

export function useSectorWithMembers(sectorId: string | undefined) {
  return useQuery<SectorWithMembers | null>({
    queryKey: ['sector', sectorId],
    queryFn: async () => {
      if (!sectorId) return null
      const { data, error } = await db
        .from('sectors')
        .select(`
          *,
          sector_members(
            id, user_id, is_supervisor,
            profiles(full_name, avatar_url, job_title)
          )
        `)
        .eq('id', sectorId)
        .single()
      if (error) throw error
      return data as SectorWithMembers
    },
    enabled: !!sectorId,
  })
}

export function useCreateSector() {
  const qc = useQueryClient()
  const { organizationId, user } = useAuth()

  return useMutation({
    mutationFn: async (values: {
      name: string
      description?: string
      color?: string
      icon?: string
    }) => {
      if (!organizationId) throw new Error('No organization')
      const { data, error } = await db
        .from('sectors')
        .insert({
          ...values,
          organization_id: organizationId,
          created_by: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Sector
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors', organizationId] }),
  })
}

export function useUpdateSector() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async ({ id, ...values }: {
      id: string
      name?: string
      description?: string
      color?: string
      icon?: string
      is_active?: boolean
    }) => {
      const { data, error } = await db
        .from('sectors')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Sector
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sectors', organizationId] })
      qc.invalidateQueries({ queryKey: ['sector', vars.id] })
    },
  })
}

export function useDeleteSector() {
  const qc = useQueryClient()
  const { organizationId } = useAuth()

  return useMutation({
    mutationFn: async (sectorId: string) => {
      const { error } = await db.from('sectors').delete().eq('id', sectorId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors', organizationId] }),
  })
}

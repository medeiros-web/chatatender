import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ProfileData {
  id: string
  organization_id: string | null
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  job_title: string | null
  timezone: string
  locale: string
  created_at: string
  updated_at: string
  organizations: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  } | null
}

export interface ProfileUpdate {
  full_name?: string | null
  avatar_url?: string | null
  phone?: string | null
  job_title?: string | null
  timezone?: string
  locale?: string
}

export function useProfile(userId: string | undefined) {
  const qc = useQueryClient()

  const query = useQuery<ProfileData | null>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*, organizations(id, name, slug, logo_url)')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as ProfileData
    },
    enabled: !!userId,
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: ProfileUpdate) => {
      if (!userId) throw new Error('No user')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
      if (error) throw error
      return data as ProfileData
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  })

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error('No user')
      const ext = file.name.split('.').pop()
      const path = `avatars/${userId}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId)
      return data.publicUrl
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  })

  return { ...query, updateMutation, uploadAvatar }
}

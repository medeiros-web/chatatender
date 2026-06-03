import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/types/database'

type ProfileStatus = 'pending' | 'active' | 'rejected' | 'suspended'

interface AuthState {
  session: Session | null
  user: User | null
  role: AppRole | null
  organizationId: string | null
  profileStatus: ProfileStatus
  isLoading: boolean
  isSuperAdmin: boolean
  isAdmin: boolean
  isApproved: boolean
}

const initialState: AuthState = {
  session: null,
  user: null,
  role: null,
  organizationId: null,
  profileStatus: 'active',
  isLoading: true,
  isSuperAdmin: false,
  isAdmin: false,
  isApproved: true,
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState)

  const loadUserData = useCallback(async (user: User | null) => {
    if (!user) {
      setState({ ...initialState, isLoading: false })
      return
    }

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('organization_id, status').eq('id', user.id).maybeSingle(),
        supabase.from('user_roles').select('role, organization_id').eq('user_id', user.id).maybeSingle(),
      ])

      const profileData = profileRes.data as { organization_id: string | null; status: string | null } | null
      const roleData    = roleRes.data as { role: AppRole; organization_id: string } | null

      const organizationId = profileData?.organization_id ?? roleData?.organization_id ?? null
      const role = (roleData?.role ?? null) as AppRole | null
      const profileStatus = (profileData?.status ?? 'active') as ProfileStatus
      const currentSession = (await supabase.auth.getSession()).data.session

      setState({
        session: currentSession,
        user,
        role,
        organizationId,
        profileStatus,
        isLoading: false,
        isSuperAdmin: role === 'super_admin',
        isAdmin: role === 'admin' || role === 'super_admin',
        isApproved: profileStatus === 'active',
      })
    } catch {
      setState({ ...initialState, isLoading: false, user, session: null })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserData(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserData(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [loadUserData])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { ...state, signOut }
}

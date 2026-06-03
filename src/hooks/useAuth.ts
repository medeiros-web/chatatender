import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/types/database'

interface AuthState {
  session: Session | null
  user: User | null
  role: AppRole | null
  organizationId: string | null
  isLoading: boolean
  isSuperAdmin: boolean
  isAdmin: boolean
}

const initialState: AuthState = {
  session: null,
  user: null,
  role: null,
  organizationId: null,
  isLoading: true,
  isSuperAdmin: false,
  isAdmin: false,
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
        supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle(),
        supabase.from('user_roles').select('role, organization_id').eq('user_id', user.id).maybeSingle(),
      ])

      const organizationId =
        (profileRes.data as { organization_id: string | null } | null)?.organization_id
        ?? (roleRes.data as { organization_id: string } | null)?.organization_id
        ?? null

      const role = ((roleRes.data as { role: AppRole } | null)?.role ?? null) as AppRole | null
      const currentSession = (await supabase.auth.getSession()).data.session

      setState({
        session: currentSession,
        user,
        role,
        organizationId,
        isLoading: false,
        isSuperAdmin: role === 'super_admin',
        isAdmin: role === 'admin' || role === 'super_admin',
      })
    } catch {
      // Se falhar (ex: RLS, rede), ainda desbloqueia o app
      setState({ ...initialState, isLoading: false, user, session: null })
    }
  }, [])

  useEffect(() => {
    // getSession primeiro — evita flash de redirect
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

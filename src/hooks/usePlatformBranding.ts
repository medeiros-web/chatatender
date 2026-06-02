import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface PlatformSettings {
  primary_color_hsl?: string
  platform_name?: string
  logo_url?: string
}

export function usePlatformBranding(organizationId?: string | null) {
  const { data } = useQuery<PlatformSettings | null>({
    queryKey: ['platform-settings', organizationId],
    queryFn: async () => null, // Módulo 14 implementa real
    enabled: false,
  })

  useEffect(() => {
    if (data?.primary_color_hsl) {
      document.documentElement.style.setProperty('--primary', data.primary_color_hsl)
    }
  }, [data])

  return {
    platformName: data?.platform_name ?? 'ChatAtender',
    logoUrl: data?.logo_url ?? null,
  }
}

export function usePlatformName() {
  return 'ChatAtender'
}

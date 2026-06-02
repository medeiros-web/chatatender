import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const db = supabase as any

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformBranding {
  platform_name: string
  logo_url: string | null
  favicon_url: string | null
  login_bg_url: string | null
  primary_color_hsl: string | null
  primary_color: string | null          // hex fallback
  support_email: string | null
  terms_url: string | null
  privacy_url: string | null
  allow_signup: boolean
  maintenance_mode: boolean
}

export interface OrgBranding {
  id: string
  organization_id: string
  platform_name: string | null
  logo_url: string | null
  favicon_url: string | null
  login_bg_url: string | null
  primary_color_hsl: string | null
  support_email: string | null
  terms_url: string | null
  privacy_url: string | null
  custom_domain: string | null
  is_active: boolean
}

// ── Parse platform_settings rows → PlatformBranding ──────────────────────────

function parseSettings(rows: { key: string; value: string | null }[]): PlatformBranding {
  const m: Record<string, string> = {}
  for (const r of rows) m[r.key] = r.value ?? ''
  return {
    platform_name:     m['platform_name']     || 'ChatAtender',
    logo_url:          m['logo_url']          || null,
    favicon_url:       m['favicon_url']       || null,
    login_bg_url:      m['login_bg_url']      || null,
    primary_color_hsl: m['primary_color_hsl'] || null,
    primary_color:     m['primary_color']     || null,
    support_email:     m['support_email']     || null,
    terms_url:         m['terms_url']         || null,
    privacy_url:       m['privacy_url']       || null,
    allow_signup:      m['allow_signup'] !== 'false',
    maintenance_mode:  m['maintenance_mode'] === 'true',
  }
}

// ── Global platform branding (super-admin controlled) ─────────────────────────

export function useGlobalBranding() {
  return useQuery<PlatformBranding>({
    queryKey: ['platform_branding_global'],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data } = await db.from('platform_settings').select('key, value')
      return parseSettings((data ?? []) as { key: string; value: string | null }[])
    },
  })
}

// ── Per-org branding (for /wl/:orgSlug and org admin) ─────────────────────────

export function useOrgBranding(orgId?: string | null) {
  return useQuery<OrgBranding | null>({
    queryKey: ['org_branding', orgId],
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await db
        .from('org_branding')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .maybeSingle()
      return (data as OrgBranding | null) ?? null
    },
  })
}

export function useUpsertOrgBranding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<OrgBranding> & { organization_id: string }) => {
      const { error } = await db.from('org_branding').upsert(values, { onConflict: 'organization_id' })
      if (error) throw error
    },
    onSuccess: (_: unknown, v: { organization_id: string }) =>
      qc.invalidateQueries({ queryKey: ['org_branding', v.organization_id] }),
  })
}

// ── Resolve branding by org slug (public, no auth) ────────────────────────────

export interface ResolvedBranding extends PlatformBranding {
  org_name: string | null
  org_slug: string | null
  org_id: string | null
}

export function useBrandingBySlug(slug?: string) {
  return useQuery<ResolvedBranding | null>({
    queryKey: ['branding_by_slug', slug],
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      // 1. Find org by slug
      const { data: orgData } = await db
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (!orgData) return null

      // 2. Get global settings
      const { data: globalData } = await db.from('platform_settings').select('key, value')
      const global = parseSettings((globalData ?? []) as { key: string; value: string | null }[])

      // 3. Get org overrides
      const { data: orgBranding } = await db
        .from('org_branding')
        .select('*')
        .eq('organization_id', orgData.id)
        .eq('is_active', true)
        .maybeSingle()

      const ov = (orgBranding ?? {}) as Partial<OrgBranding>

      return {
        ...global,
        platform_name:     ov.platform_name     || global.platform_name,
        logo_url:          ov.logo_url          || global.logo_url,
        favicon_url:       ov.favicon_url       || global.favicon_url,
        login_bg_url:      ov.login_bg_url      || global.login_bg_url,
        primary_color_hsl: ov.primary_color_hsl || global.primary_color_hsl,
        support_email:     ov.support_email     || global.support_email,
        terms_url:         ov.terms_url         || global.terms_url,
        privacy_url:       ov.privacy_url       || global.privacy_url,
        org_name:  orgData.name,
        org_slug:  orgData.slug,
        org_id:    orgData.id,
      } satisfies ResolvedBranding
    },
  })
}

// ── Main hook used by AdminLayout / LoginPage ──────────────────────────────────
// Injects --primary CSS variable and updates favicon/title automatically

export function usePlatformBranding(organizationId?: string | null) {
  const { data: global } = useGlobalBranding()
  const { data: orgBranding } = useOrgBranding(organizationId)

  // Merge: org overrides global
  const resolved: PlatformBranding = {
    platform_name:     orgBranding?.platform_name     || global?.platform_name     || 'ChatAtender',
    logo_url:          orgBranding?.logo_url          || global?.logo_url          || null,
    favicon_url:       orgBranding?.favicon_url       || global?.favicon_url       || null,
    login_bg_url:      orgBranding?.login_bg_url      || global?.login_bg_url      || null,
    primary_color_hsl: orgBranding?.primary_color_hsl || global?.primary_color_hsl || null,
    primary_color:     global?.primary_color          || null,
    support_email:     orgBranding?.support_email     || global?.support_email     || null,
    terms_url:         orgBranding?.terms_url         || global?.terms_url         || null,
    privacy_url:       orgBranding?.privacy_url       || global?.privacy_url       || null,
    allow_signup:      global?.allow_signup    ?? true,
    maintenance_mode:  global?.maintenance_mode ?? false,
  }

  // Inject CSS custom property
  useEffect(() => {
    if (resolved.primary_color_hsl) {
      document.documentElement.style.setProperty('--primary', resolved.primary_color_hsl)
    }
  }, [resolved.primary_color_hsl])

  // Update favicon
  useEffect(() => {
    if (!resolved.favicon_url) return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = resolved.favicon_url
  }, [resolved.favicon_url])

  // Update document title
  useEffect(() => {
    if (resolved.platform_name && resolved.platform_name !== 'ChatAtender') {
      document.title = resolved.platform_name
    }
  }, [resolved.platform_name])

  return {
    platformName: resolved.platform_name,
    logoUrl:      resolved.logo_url,
    branding:     resolved,
  }
}

// ── Convenience: just the platform name ───────────────────────────────────────

export function usePlatformName(): string {
  const { data } = useGlobalBranding()
  return data?.platform_name ?? 'ChatAtender'
}

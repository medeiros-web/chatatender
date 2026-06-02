import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useBrandingBySlug } from '@/hooks/usePlatformBranding'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  MessageSquare, Calendar, FileText, Zap,
  Mail, ExternalLink, ChevronRight, Globe,
} from 'lucide-react'

const db = supabase as any

// ── Public pages for the org ──────────────────────────────────────────────────

interface PublicLink {
  type: 'funnel' | 'form' | 'booking'
  title: string
  slug: string
  description?: string | null
}

function useOrgPublicLinks(orgId: string | null) {
  return useQuery<PublicLink[]>({
    queryKey: ['org_public_links', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [funnels, forms, bookings] = await Promise.all([
        db.from('funnels').select('id, title, slug, description').eq('organization_id', orgId).eq('is_published', true).order('created_at'),
        db.from('forms').select('id, title, slug, description').eq('organization_id', orgId).eq('is_published', true).order('created_at'),
        db.from('booking_event_types').select('id, name, slug, description').eq('organization_id', orgId).eq('is_active', true).order('created_at'),
      ])
      const links: PublicLink[] = [
        ...((funnels.data ?? []) as any[]).map((f: any) => ({ type: 'funnel' as const, title: f.title, slug: f.slug, description: f.description })),
        ...((forms.data ?? []) as any[]).map((f: any) => ({ type: 'form' as const, title: f.title, slug: f.slug, description: f.description })),
        ...((bookings.data ?? []) as any[]).map((b: any) => ({ type: 'booking' as const, title: b.name, slug: b.slug, description: b.description })),
      ]
      return links
    },
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

const typeConfig = {
  funnel: {
    label: 'Funil de vendas',
    icon: Zap,
    color: 'bg-orange-500/10 text-orange-500',
    href: (slug: string) => `/funnel/${slug}`,
  },
  form: {
    label: 'Formulário',
    icon: FileText,
    color: 'bg-teal-500/10 text-teal-500',
    href: (slug: string) => `/f/${slug}`,
  },
  booking: {
    label: 'Agendamento',
    icon: Calendar,
    color: 'bg-blue-500/10 text-blue-500',
    href: (slug: string) => `/booking/${slug}`,
  },
}

export function PublicOrgPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const { data: branding, isLoading } = useBrandingBySlug(orgSlug)
  const { data: links = [] } = useOrgPublicLinks(branding?.org_id ?? null)

  // Apply branding CSS
  useEffect(() => {
    if (branding?.primary_color_hsl) {
      document.documentElement.style.setProperty('--primary', branding.primary_color_hsl)
    }
    return () => {
      // Reset to default on unmount
      document.documentElement.style.removeProperty('--primary')
    }
  }, [branding?.primary_color_hsl])

  // Update favicon
  useEffect(() => {
    if (!branding?.favicon_url) return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = branding.favicon_url
  }, [branding?.favicon_url])

  // Update title
  useEffect(() => {
    if (branding?.org_name) document.title = branding.org_name
    return () => { document.title = branding?.platform_name ?? 'ChatAtender' }
  }, [branding?.org_name, branding?.platform_name])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!branding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center p-8">
        <Globe className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground">Organização não encontrada</h1>
        <p className="text-sm text-muted-foreground mt-2">O endereço <code className="font-mono bg-muted px-1 rounded">{orgSlug}</code> não está ativo.</p>
      </div>
    )
  }

  const hslValue = branding.primary_color_hsl ?? '262.1 83.3% 57.8%'
  const primaryHsl = `hsl(${hslValue})`

  return (
    <div
      className="min-h-screen bg-background"
      style={{ '--primary': hslValue } as React.CSSProperties}
    >
      {/* Hero / Header */}
      <div
        className="relative overflow-hidden"
        style={branding.login_bg_url
          ? { backgroundImage: `url(${branding.login_bg_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: `linear-gradient(135deg, ${primaryHsl}22 0%, ${primaryHsl}08 100%)` }
        }
      >
        {branding.login_bg_url && (
          <div className="absolute inset-0 bg-black/50" />
        )}
        <div className="relative max-w-3xl mx-auto px-6 py-16 text-center">
          {/* Logo */}
          {branding.logo_url
            ? <img src={branding.logo_url} alt={branding.org_name ?? ''} className="h-16 w-auto mx-auto mb-6 object-contain" />
            : (
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: primaryHsl }}>
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
            )
          }

          <h1 className={`font-display text-3xl font-bold ${branding.login_bg_url ? 'text-white' : 'text-foreground'}`}>
            {branding.org_name ?? branding.platform_name}
          </h1>
          <p className={`mt-2 text-base ${branding.login_bg_url ? 'text-white/80' : 'text-muted-foreground'}`}>
            Bem-vindo(a) ao nosso portal
          </p>

          {branding.support_email && (
            <a
              href={`mailto:${branding.support_email}`}
              className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
              style={{ color: branding.login_bg_url ? 'white' : undefined }}
            >
              <Mail className="h-3.5 w-3.5" />
              {branding.support_email}
            </a>
          )}
        </div>
      </div>

      {/* Public Links */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {links.length > 0 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Acesse nossos serviços</h2>
            <div className="space-y-3">
              {links.map((link, i) => {
                const cfg = typeConfig[link.type]
                const Icon = cfg.icon
                const href = cfg.href(link.slug)

                return (
                  <Link
                    key={`${link.type}-${i}`}
                    to={href}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
                  >
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{link.title}</p>
                      {link.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{link.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          </>
        )}

        {links.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum conteúdo público disponível</p>
            <p className="text-xs text-muted-foreground mt-1">Esta organização ainda não publicou funis, formulários ou agendamentos.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {branding.org_name ?? branding.platform_name}. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            {branding.terms_url && (
              <a href={branding.terms_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                Termos <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {branding.privacy_url && (
              <a href={branding.privacy_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                Privacidade <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {branding.support_email && (
              <a href={`mailto:${branding.support_email}`} className="hover:text-foreground">Suporte</a>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

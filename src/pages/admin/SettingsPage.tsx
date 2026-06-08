import { useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import {
  useSAUsers, useSetUserStatus,
  usePlatformSettings, useUpdatePlatformSetting,
  useSystemHealth, useRunHealthChecks,
  useAuditLogs,
} from '@/hooks/useSuperAdmin'
import { useDeleteLead } from '@/hooks/useLeads'
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  Settings, Users, Trash2, RefreshCw, Shield, Activity,
  Search, ChevronDown, CheckCircle2, XCircle, AlertTriangle,
  Database, Zap, Lock, UserCog, Eye, Building2,
  MoreVertical, UserX, UserCheck, Edit2, Plus, Save,
  Globe, Clock, Bell, Palette, BarChart3,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const db = supabase as any

// ── utils ──────────────────────────────────────────────────────────────────────
function timeAgo(iso: string | null) {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return format(new Date(iso), 'dd/MM/yyyy HH:mm')
}
function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── SA leads hook (cross-org) ─────────────────────────────────────────────────
interface SALead {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  lead_score: number
  source: string
  is_archived: boolean
  created_at: string
  organization_id: string
  organizations?: { name: string }
}

function useSALeads(search: string) {
  return useQuery<SALead[]>({
    queryKey: ['sa_leads_all', search],
    queryFn: async () => {
      let q = db.from('leads')
        .select('id, name, email, phone, company, lead_score, source, is_archived, created_at, organization_id, organizations(name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as SALead[]
    },
  })
}

function useDeleteLeadSA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('leads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa_leads_all'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

// ── Org settings hook ─────────────────────────────────────────────────────────
interface OrgSettings {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: Record<string, unknown> | null
}

function useOrgSettings(orgId: string | null) {
  return useQuery<OrgSettings | null>({
    queryKey: ['org_settings', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data, error } = await db.from('organizations').select('id, name, slug, logo_url, settings').eq('id', orgId).single()
      if (error) throw error
      return data as OrgSettings
    },
    enabled: !!orgId,
  })
}

function useUpdateOrgSettings(orgId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<OrgSettings>) => {
      if (!orgId) throw new Error('No org')
      const { error } = await db.from('organizations').update(values).eq('id', orgId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org_settings', orgId] }),
  })
}

// ── status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Ativo',      cls: 'bg-emerald-100 text-emerald-700' },
    pending:   { label: 'Pendente',   cls: 'bg-yellow-100 text-yellow-700' },
    suspended: { label: 'Suspenso',   cls: 'bg-red-100 text-red-700' },
    rejected:  { label: 'Rejeitado',  cls: 'bg-gray-100 text-gray-600' },
  }
  const { label, cls } = cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cls)}>{label}</span>
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string | null }) {
  const cfg: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin:       'bg-blue-100 text-blue-700',
    manager:     'bg-cyan-100 text-cyan-700',
    agent:       'bg-gray-100 text-gray-600',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg[role ?? 'agent'] ?? 'bg-gray-100 text-gray-600')}>
      {role ?? 'agent'}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab: Geral
// ══════════════════════════════════════════════════════════════════════════════
function TabGeral({ orgId }: { orgId: string | null }) {
  const { data: org, isLoading } = useOrgSettings(orgId)
  const update = useUpdateOrgSettings(orgId)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saved, setSaved] = useState(false)

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Carregando…</div>

  const handleSave = async () => {
    await update.mutateAsync({ name: name || org?.name, slug: slug || org?.slug })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Identidade da Organização</CardTitle>
          <CardDescription>Nome público, slug e aparência básica</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome da organização</label>
              <Input
                defaultValue={org?.name ?? ''}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Empresa Ltda"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Slug (URL)</label>
              <Input
                defaultValue={org?.slug ?? ''}
                onChange={e => setSlug(e.target.value)}
                placeholder="empresa-ltda"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">ID da organização</label>
            <Input value={orgId ?? ''} readOnly className="bg-muted text-muted-foreground font-mono text-xs" />
          </div>
          <Button onClick={handleSave} disabled={update.isPending} size="sm" className="gap-2">
            <Save className="h-3.5 w-3.5" />
            {saved ? 'Salvo!' : update.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Preferências do sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Fuso horário padrão', value: 'America/Sao_Paulo', note: 'America/Sao_Paulo (UTC-3)' },
            { label: 'Idioma', value: 'pt-BR', note: 'Português (Brasil)' },
            { label: 'Formato de data', value: 'dd/MM/yyyy', note: 'Ex: 08/06/2026' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm font-medium">{row.label}</span>
              <span className="text-sm text-muted-foreground">{row.note}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab: Desempenho
// ══════════════════════════════════════════════════════════════════════════════
const PERF_DEFAULTS = {
  query_stale_time_ms:    '300000',
  query_retry_count:      '1',
  leads_page_size:        '100',
  inbox_refresh_interval: '10000',
  ai_max_tokens:          '400',
  ai_temperature:         '0.7',
  webhook_timeout_ms:     '10000',
  cache_max_age_s:        '3600',
}

function TabDesempenho({ isSA }: { isSA: boolean }) {
  const { data: settings = [] } = usePlatformSettings()
  const updateSetting = useUpdatePlatformSetting()
  const [local, setLocal] = useState<Record<string, string>>({})
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())

  const getValue = (key: string) =>
    local[key] ?? settings.find(s => s.key === key)?.value ?? PERF_DEFAULTS[key as keyof typeof PERF_DEFAULTS] ?? ''

  const saveKey = async (key: string) => {
    if (!isSA) return
    await updateSetting.mutateAsync({ key, value: getValue(key) })
    setSavedKeys(prev => new Set([...prev, key]))
    setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(key); return n }), 2000)
  }

  const rows: { key: string; label: string; desc: string; unit?: string }[] = [
    { key: 'query_stale_time_ms',    label: 'Cache stale time',         desc: 'Tempo (ms) antes de refetch automático',      unit: 'ms' },
    { key: 'query_retry_count',      label: 'Tentativas de retry',      desc: 'Número de retries em falha de query' },
    { key: 'leads_page_size',        label: 'Leads por página',         desc: 'Máx de leads carregados por listagem' },
    { key: 'inbox_refresh_interval', label: 'Refresh do Inbox',         desc: 'Intervalo de polling (ms)',                   unit: 'ms' },
    { key: 'ai_max_tokens',          label: 'Tokens máx (IA)',          desc: 'Limite de tokens por resposta da IA' },
    { key: 'ai_temperature',         label: 'Temperature padrão (IA)',  desc: 'Criatividade da IA (0.0 – 1.0)' },
    { key: 'webhook_timeout_ms',     label: 'Timeout webhooks',         desc: 'Timeout máx para chamadas de webhook',        unit: 'ms' },
    { key: 'cache_max_age_s',        label: 'Cache HTTP (CDN)',         desc: 'Idade máxima do cache estático',              unit: 's' },
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Parâmetros de desempenho</CardTitle>
          <CardDescription>
            {isSA ? 'Ajuste os parâmetros globais do sistema.' : 'Visualização dos parâmetros. Somente Super Admin pode editar.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map(row => (
            <div key={row.key} className="flex items-center gap-3 py-2 border-b last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  value={getValue(row.key)}
                  onChange={e => setLocal(p => ({ ...p, [row.key]: e.target.value }))}
                  readOnly={!isSA}
                  className={cn('w-28 h-8 text-sm font-mono', !isSA && 'bg-muted')}
                />
                {row.unit && <span className="text-xs text-muted-foreground w-6">{row.unit}</span>}
                {isSA && (
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => saveKey(row.key)}>
                    {savedKeys.has(row.key) ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Save className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Limites de uso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: 'Max leads por org',   value: '10.000' },
            { label: 'Max agentes IA',      value: '5 por produto' },
            { label: 'Max usuários',        value: 'Por plano' },
            { label: 'Max mensagens/dia',   value: 'Sem limite (plano Pro)' },
            { label: 'Retenção de logs',    value: '90 dias' },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium">{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab: Usuários (SA only)
// ══════════════════════════════════════════════════════════════════════════════
function TabUsuarios() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const { data: users = [], isLoading, refetch } = useSAUsers()
  const setStatus = useSetUserStatus()
  const [confirmUser, setConfirmUser] = useState<{ id: string; action: 'suspended' | 'active' | 'rejected'; name: string } | null>(null)

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || (u.full_name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchStatus = statusFilter === 'all' || u.status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-8 h-8 text-sm" />
        </div>
        <select
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">Todos os roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="agent">Agent</option>
        </select>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending">Pendente</option>
          <option value="suspended">Suspenso</option>
          <option value="rejected">Rejeitado</option>
        </select>
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-8 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} usuário(s)</span>
      </div>

      <Card>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Usuário</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Organização</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Criado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials(u.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-tight">{u.full_name ?? '(sem nome)'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">{u.org_name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role ?? null} /></td>
                  <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{timeAgo(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {u.status !== 'active' && (
                          <DropdownMenuItem onClick={() => setConfirmUser({ id: u.id, action: 'active', name: u.full_name ?? u.email })}>
                            <UserCheck className="h-4 w-4 mr-2 text-emerald-500" /> Ativar
                          </DropdownMenuItem>
                        )}
                        {u.status !== 'suspended' && (
                          <DropdownMenuItem onClick={() => setConfirmUser({ id: u.id, action: 'suspended', name: u.full_name ?? u.email })}>
                            <UserX className="h-4 w-4 mr-2 text-yellow-500" /> Suspender
                          </DropdownMenuItem>
                        )}
                        {u.status !== 'rejected' && (
                          <DropdownMenuItem onClick={() => setConfirmUser({ id: u.id, action: 'rejected', name: u.full_name ?? u.email })} className="text-destructive">
                            <XCircle className="h-4 w-4 mr-2" /> Rejeitar acesso
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={!!confirmUser} onOpenChange={() => setConfirmUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar ação</DialogTitle>
          </DialogHeader>
          {confirmUser && (
            <p className="text-sm text-muted-foreground">
              Deseja <strong>{confirmUser.action === 'active' ? 'ativar' : confirmUser.action === 'suspended' ? 'suspender' : 'rejeitar'}</strong> o usuário <strong>{confirmUser.name}</strong>?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUser(null)}>Cancelar</Button>
            <Button
              variant={confirmUser?.action === 'active' ? 'default' : 'destructive'}
              disabled={setStatus.isPending}
              onClick={async () => {
                if (!confirmUser) return
                await setStatus.mutateAsync({ userId: confirmUser.id, status: confirmUser.action })
                setConfirmUser(null)
              }}
            >
              {setStatus.isPending ? 'Aguarde…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab: Leads (SA — gestão global)
// ══════════════════════════════════════════════════════════════════════════════
function TabLeads({ isSA, orgId }: { isSA: boolean; orgId: string | null }) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)

  const { data: leads = [], isLoading, refetch } = isSA
    ? useSALeads(debouncedSearch)
    // non-SA: use org-scoped leads
    : useQuery<SALead[]>({
        queryKey: ['leads_settings', orgId, debouncedSearch],
        queryFn: async () => {
          if (!orgId) return []
          let q = db.from('leads')
            .select('id, name, email, phone, company, lead_score, source, is_archived, created_at, organization_id')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(200)
          if (debouncedSearch) q = q.or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`)
          const { data, error } = await q
          if (error) throw error
          return (data ?? []) as SALead[]
        },
        enabled: !!orgId,
      })

  const deleteMut = useDeleteLeadSA()

  const handleSearch = (val: string) => {
    setSearch(val)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => setDebouncedSearch(val), 400)
  }

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () =>
    setSelected(prev => prev.size === leads.length ? new Set() : new Set(leads.map(l => l.id)))

  const scoreColor = (s: number) => s >= 70 ? 'text-emerald-600' : s >= 40 ? 'text-yellow-600' : 'text-muted-foreground'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar lead…" className="pl-8 h-8 text-sm" />
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-8 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
        {selected.size > 0 && (
          <Button size="sm" variant="destructive" className="h-8 gap-1.5 ml-auto" onClick={() => setConfirmDelete([...selected])}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir {selected.size} selecionado(s)
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{leads.length} lead(s)</span>
      </div>

      <Card>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === leads.length && leads.length > 0}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded"
                  />
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nome</th>
                {isSA && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Organização</th>}
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Contato</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fonte</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Criado</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={isSA ? 8 : 7} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && leads.length === 0 && (
                <tr><td colSpan={isSA ? 8 : 7} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</td></tr>
              )}
              {leads.map(l => (
                <tr key={l.id} className={cn('border-b last:border-0 transition-colors', selected.has(l.id) ? 'bg-primary/5' : 'hover:bg-muted/30')}>
                  <td className="px-4 py-2.5 text-center">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} className="h-3.5 w-3.5 rounded" />
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium leading-tight">{l.name}</p>
                    {l.company && <p className="text-xs text-muted-foreground">{l.company}</p>}
                  </td>
                  {isSA && (
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{(l as any).organizations?.name ?? '—'}</span>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {l.email && <div>{l.email}</div>}
                    {l.phone && <div>{l.phone}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('font-semibold text-sm', scoreColor(l.lead_score))}>{l.lead_score}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{l.source}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{timeAgo(l.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete([l.id])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Excluir lead(s)
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir permanentemente <strong>{confirmDelete?.length}</strong> lead(s)?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={async () => {
                if (!confirmDelete) return
                for (const id of confirmDelete) await deleteMut.mutateAsync(id)
                setSelected(new Set())
                setConfirmDelete(null)
              }}
            >
              {deleteMut.isPending ? 'Excluindo…' : 'Excluir definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab: Segurança / Auditoria (SA)
// ══════════════════════════════════════════════════════════════════════════════
function TabSeguranca() {
  const { data: health = [], isLoading: healthLoading } = useSystemHealth()
  const runChecks = useRunHealthChecks()
  const { data: logs = [], isLoading: logsLoading } = useAuditLogs(50)

  const latest = (svc: string) => health.find(h => h.service === svc)

  const services = ['supabase_db', 'supabase_auth', 'edge_functions', 'whatsapp_webhook']

  const statusIcon = (s: string | undefined) => {
    if (!s) return <span className="h-2 w-2 rounded-full bg-gray-300 inline-block" />
    if (s === 'ok') return <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
    if (s === 'degraded') return <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
    return <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Saúde do sistema</CardTitle>
            <CardDescription>Status em tempo real dos serviços</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => runChecks.mutate()} disabled={runChecks.isPending} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', runChecks.isPending && 'animate-spin')} />
            Testar agora
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {services.map(svc => {
              const h = latest(svc)
              return (
                <div key={svc} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {statusIcon(h?.status)}
                    <span className="text-sm font-medium">{svc.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right">
                    {h ? (
                      <>
                        <p className={cn('text-xs font-medium', h.status === 'ok' ? 'text-emerald-600' : h.status === 'degraded' ? 'text-yellow-600' : 'text-red-600')}>
                          {h.status}
                        </p>
                        {h.latency_ms != null && <p className="text-[10px] text-muted-foreground">{h.latency_ms}ms</p>}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem dados</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Auditoria — últimas ações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Ação</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Recurso</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Quando</th>
                </tr>
              </thead>
              <tbody>
                {logsLoading && (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Carregando…</td></tr>
                )}
                {logs.map(log => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{log.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {log.resource_type && <span className="font-medium">{log.resource_type}</span>}
                      {log.resource_id && <span className="ml-1 opacity-60">#{log.resource_id.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {(log.profiles as any)?.email ?? log.user_id?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{timeAgo(log.created_at)}</td>
                  </tr>
                ))}
                {!logsLoading && logs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Sem registros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab: Plataforma (SA — platform_settings)
// ══════════════════════════════════════════════════════════════════════════════
function TabPlataforma() {
  const { data: settings = [], isLoading } = usePlatformSettings()
  const updateSetting = useUpdatePlatformSetting()
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const getValue = (key: string, current: string | null) => editing[key] ?? current ?? ''

  const save = async (key: string, current: string | null) => {
    await updateSetting.mutateAsync({ key, value: getValue(key, current) })
    setSaved(prev => new Set([...prev, key]))
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(key); return n }), 2000)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Configurações da plataforma</CardTitle>
          <CardDescription>Variáveis globais do sistema (platform_settings)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-56">Chave</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">Descrição</th>
                  <th className="px-4 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>
                )}
                {settings.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-primary">{s.key}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={getValue(s.key, s.value)}
                        type={s.is_secret ? 'password' : 'text'}
                        onChange={e => setEditing(p => ({ ...p, [s.key]: e.target.value }))}
                        className="h-7 text-xs font-mono max-w-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{s.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => save(s.key, s.value)}>
                        {saved.has(s.key) ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!isLoading && settings.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma configuração encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main: SettingsPage
// ══════════════════════════════════════════════════════════════════════════════
export function SettingsPage() {
  const { user, isSuperAdmin, organizationId } = useAuth()
  const [tab, setTab] = useState('geral')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold font-display">Configurações</h1>
            <p className="text-sm text-muted-foreground">
              {isSuperAdmin ? 'Controle total da plataforma — Super Admin' : 'Ajustes da organização'}
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <Badge className="gap-1.5 bg-purple-100 text-purple-700 hover:bg-purple-100">
            <Shield className="h-3 w-3" /> Super Admin
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
          <div className="px-6 pt-4 border-b">
            <TabsList className="h-9 gap-1 bg-muted/50">
              <TabsTrigger value="geral" className="h-7 text-xs gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Geral
              </TabsTrigger>
              <TabsTrigger value="desempenho" className="h-7 text-xs gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Desempenho
              </TabsTrigger>
              <TabsTrigger value="leads" className="h-7 text-xs gap-1.5">
                <Users className="h-3.5 w-3.5" /> Leads
              </TabsTrigger>
              {isSuperAdmin && (
                <>
                  <TabsTrigger value="usuarios" className="h-7 text-xs gap-1.5">
                    <UserCog className="h-3.5 w-3.5" /> Usuários
                  </TabsTrigger>
                  <TabsTrigger value="plataforma" className="h-7 text-xs gap-1.5">
                    <Database className="h-3.5 w-3.5" /> Plataforma
                  </TabsTrigger>
                  <TabsTrigger value="seguranca" className="h-7 text-xs gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Segurança
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <TabsContent value="geral" className="mt-0">
              <TabGeral orgId={organizationId} />
            </TabsContent>

            <TabsContent value="desempenho" className="mt-0">
              <TabDesempenho isSA={isSuperAdmin} />
            </TabsContent>

            <TabsContent value="leads" className="mt-0">
              <TabLeads isSA={isSuperAdmin} orgId={organizationId} />
            </TabsContent>

            {isSuperAdmin && (
              <>
                <TabsContent value="usuarios" className="mt-0">
                  <TabUsuarios />
                </TabsContent>

                <TabsContent value="plataforma" className="mt-0">
                  <TabPlataforma />
                </TabsContent>

                <TabsContent value="seguranca" className="mt-0">
                  <TabSeguranca />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  )
}

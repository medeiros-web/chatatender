import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  UserPlus, Search, MoreVertical, Mail, Phone, MapPin,
  Briefcase, Shield, Users, CheckCircle2, Clock, XCircle,
  Pencil, Trash2, Eye, IdCard, Building2,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const db = supabase as any

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  full_name: string
  email: string
  phone: string | null
  cpf_cnpj: string | null
  address: string | null
  profession: string | null
  notes: string | null
  role: string
  status: string
  created_at: string
  avatar_url: string | null
}

interface MemberForm {
  full_name: string
  email: string
  phone: string
  cpf_cnpj: string
  address: string
  profession: string
  role: string
  notes: string
}

const EMPTY_FORM: MemberForm = {
  full_name: '',
  email: '',
  phone: '',
  cpf_cnpj: '',
  address: '',
  profession: '',
  role: 'agent',
  notes: '',
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  admin:       { label: 'Admin',       color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  manager:     { label: 'Gerente',     color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  agent:       { label: 'Agente',      color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  active:    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  pending:   <Clock        className="h-3.5 w-3.5 text-amber-500" />,
  suspended: <XCircle      className="h-3.5 w-3.5 text-red-500" />,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useTeamMembers(organizationId: string | null) {
  return useQuery<TeamMember[]>({
    queryKey: ['team_members', organizationId],
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email, phone, cpf_cnpj, address, profession, notes, avatar_url, created_at, user_roles(role, status)')
        .eq('organization_id', organizationId)
        .order('full_name')
      if (error) throw error
      return (data ?? []).map((p: any) => ({
        ...p,
        role:   p.user_roles?.[0]?.role   ?? 'agent',
        status: p.user_roles?.[0]?.status ?? 'active',
      }))
    },
  })
}

function useUpsertMember(organizationId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: MemberForm }) => {
      if (id) {
        const { error } = await db
          .from('profiles')
          .update({
            full_name:  form.full_name,
            phone:      form.phone || null,
            cpf_cnpj:   form.cpf_cnpj || null,
            address:    form.address || null,
            profession: form.profession || null,
            notes:      form.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (error) throw error
        await db.from('user_roles').update({ role: form.role }).eq('user_id', id).eq('organization_id', organizationId)
      } else {
        // Invite via edge function
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              email:       form.email,
              full_name:   form.full_name,
              role:        form.role,
              phone:       form.phone || null,
              cpf_cnpj:    form.cpf_cnpj || null,
              address:     form.address || null,
              profession:  form.profession || null,
              notes:       form.notes || null,
              organization_id: organizationId,
            }),
          }
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Erro ao criar usuário')
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members', organizationId] }),
  })
}

function useUpdateStatus(organizationId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const { error } = await db
        .from('user_roles')
        .update({ status })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members', organizationId] }),
  })
}

// ── Member Form Dialog ─────────────────────────────────────────────────────────

interface MemberDialogProps {
  open: boolean
  onClose: () => void
  initial?: TeamMember | null
  organizationId: string | null
}

function MemberDialog({ open, onClose, initial, organizationId }: MemberDialogProps) {
  const [form, setForm] = useState<MemberForm>(initial ? {
    full_name:  initial.full_name,
    email:      initial.email,
    phone:      initial.phone ?? '',
    cpf_cnpj:   initial.cpf_cnpj ?? '',
    address:    initial.address ?? '',
    profession: initial.profession ?? '',
    role:       initial.role,
    notes:      initial.notes ?? '',
  } : EMPTY_FORM)

  const upsert = useUpsertMember(organizationId)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  function field(key: keyof MemberForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(f => ({ ...f, [key]: e.target.value }))
        setError(null)
      },
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nome é obrigatório'); return }
    if (!isEdit && !form.email.trim()) { setError('E-mail é obrigatório'); return }
    setError(null)
    try {
      await upsert.mutateAsync({ id: initial?.id, form })
      onClose()
      setForm(EMPTY_FORM)
    } catch (err: any) {
      setError(err.message ?? 'Erro ao salvar')
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-primary/90 to-primary px-6 py-5 rounded-t-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 opacity-80" />
              {isEdit ? 'Editar Membro' : 'Cadastrar Novo Membro'}
            </DialogTitle>
            <DialogDescription className="text-white/70 text-sm">
              {isEdit
                ? 'Atualize as informações do membro da equipe.'
                : 'Preencha os dados e envie o convite por e-mail.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Seção: Identidade */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <IdCard className="h-3.5 w-3.5" />
              Identidade
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="full_name">Nome completo <span className="text-destructive">*</span></Label>
                <Input id="full_name" placeholder="João da Silva" {...field('full_name')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail {!isEdit && <span className="text-destructive">*</span>}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@empresa.com"
                  disabled={isEdit}
                  value={isEdit ? initial!.email : form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf_cnpj">CPF / CNPJ</Label>
                <Input
                  id="cpf_cnpj"
                  placeholder="000.000.000-00"
                  value={form.cpf_cnpj}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
                    setForm(f => ({ ...f, cpf_cnpj: raw ? formatCpfCnpj(raw) : '' }))
                  }}
                />
              </div>
            </div>
          </section>

          {/* Seção: Contato */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              Contato
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    className="pl-9"
                    placeholder="(11) 99999-9999"
                    value={form.phone}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
                      setForm(f => ({ ...f, phone: raw ? formatPhone(raw) : '' }))
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profession">Profissão / Cargo</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profession"
                    className="pl-9"
                    placeholder="Consultor de vendas"
                    {...field('profession')}
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    className="pl-9"
                    placeholder="Rua das Flores, 123 — São Paulo, SP"
                    {...field('address')}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Seção: Permissões */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Permissões
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Perfil de acesso</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span className="font-medium">Admin</span>
                      <span className="text-xs text-muted-foreground">Gerencia equipe, setores e configurações</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex flex-col">
                      <span className="font-medium">Gerente</span>
                      <span className="text-xs text-muted-foreground">Supervisiona agentes e relatórios</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="agent">
                    <div className="flex flex-col">
                      <span className="font-medium">Agente</span>
                      <span className="text-xs text-muted-foreground">Atende leads e conversa no inbox</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Seção: Observações */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Pencil className="h-3.5 w-3.5" />
              Observações
            </div>
            <Textarea
              id="notes"
              placeholder="Informações adicionais, histórico, especialidades…"
              className="min-h-[96px] resize-none"
              {...field('notes')}
            />
          </section>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-center gap-2">
              <XCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={upsert.isPending}>
              {upsert.isPending
                ? 'Salvando…'
                : isEdit ? 'Salvar alterações' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── View Dialog ────────────────────────────────────────────────────────────────

function ViewDialog({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  if (!member) return null
  const role = ROLE_LABELS[member.role] ?? ROLE_LABELS.agent
  return (
    <Dialog open={!!member} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/80 to-primary h-28 relative">
          <div className="absolute -bottom-10 left-6">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarFallback className="text-2xl bg-sidebar text-sidebar-foreground font-bold">
                {initials(member.full_name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <div className="pt-12 px-6 pb-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold">{member.full_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-xs font-medium border rounded-full px-2 py-0.5', role.color)}>
                {role.label}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {STATUS_ICONS[member.status]}
                {member.status === 'active' ? 'Ativo' : member.status === 'pending' ? 'Pendente' : 'Suspenso'}
              </span>
            </div>
          </div>

          <div className="grid gap-3 text-sm">
            {[
              { icon: Mail,      label: 'E-mail',    val: member.email },
              { icon: Phone,     label: 'Telefone',  val: member.phone },
              { icon: IdCard,    label: 'CPF/CNPJ',  val: member.cpf_cnpj },
              { icon: Briefcase, label: 'Profissão', val: member.profession },
              { icon: MapPin,    label: 'Endereço',  val: member.address },
            ].filter(r => r.val).map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="text-foreground">{val}</p>
                </div>
              </div>
            ))}
            {member.notes && (
              <div className="flex items-start gap-3">
                <Pencil className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
                  <p className="text-foreground whitespace-pre-wrap">{member.notes}</p>
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function TeamPage() {
  const { organizationId, isAdmin, isSuperAdmin } = useAuth()
  const canManage = isAdmin || isSuperAdmin

  const { data: members = [], isLoading } = useTeamMembers(organizationId)
  const updateStatus = useUpdateStatus(organizationId)

  const [search, setSearch]     = useState('')
  const [roleFilter, setRole]   = useState<string>('all')
  const [dialogOpen, setDialog] = useState(false)
  const [editing, setEditing]   = useState<TeamMember | null>(null)
  const [viewing, setViewing]   = useState<TeamMember | null>(null)

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    const matchRole   = roleFilter === 'all' || m.role === roleFilter
    return matchSearch && matchRole
  })

  const stats = {
    total:   members.length,
    active:  members.filter(m => m.status === 'active').length,
    pending: members.filter(m => m.status === 'pending').length,
    admins:  members.filter(m => m.role === 'admin' || m.role === 'super_admin').length,
  }

  return (
    <div className="flex flex-col h-full gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os membros e permissões do time.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => { setEditing(null); setDialog(true) }}
            className="gap-2 shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Novo membro
          </Button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total,   icon: Users,        color: 'text-blue-600' },
          { label: 'Ativos', value: stats.active,  icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Pendentes', value: stats.pending, icon: Clock,    color: 'text-amber-600' },
          { label: 'Admins', value: stats.admins,  icon: Shield,       color: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
            <div className={cn('rounded-lg p-2 bg-current/10', color)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'admin', 'manager', 'agent'].map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                roleFilter === r
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-accent'
              )}
            >
              {r === 'all' ? 'Todos' : ROLE_LABELS[r]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Members grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 h-36 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Users className="h-12 w-12 opacity-20" />
          <p className="text-sm">Nenhum membro encontrado.</p>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => { setEditing(null); setDialog(true) }}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar primeiro membro
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => {
            const role = ROLE_LABELS[member.role] ?? ROLE_LABELS.agent
            return (
              <div
                key={member.id}
                className="group rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* subtle gradient top bar */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r from-primary/60 to-primary/20" />

                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 border-2 border-border">
                    <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                      {initials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={cn('text-[11px] font-medium border rounded-full px-2 py-0.5 leading-none', role.color)}>
                        {role.label}
                      </span>
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        {STATUS_ICONS[member.status]}
                        {member.status === 'active' ? 'Ativo' : member.status === 'pending' ? 'Pendente' : 'Suspenso'}
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setViewing(member)}>
                          <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditing(member); setDialog(true) }}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {member.status === 'active' ? (
                          <DropdownMenuItem
                            className="text-amber-600"
                            onClick={() => updateStatus.mutate({ userId: member.id, status: 'suspended' })}
                          >
                            <XCircle className="h-4 w-4 mr-2" /> Suspender
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-emerald-600"
                            onClick={() => updateStatus.mutate({ userId: member.id, status: 'active' })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Ativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Info chips */}
                <div className="flex flex-wrap gap-1.5">
                  {member.profession && (
                    <span className="flex items-center gap-1 text-[11px] bg-muted/60 rounded px-2 py-0.5 text-muted-foreground">
                      <Briefcase className="h-3 w-3" />{member.profession}
                    </span>
                  )}
                  {member.phone && (
                    <span className="flex items-center gap-1 text-[11px] bg-muted/60 rounded px-2 py-0.5 text-muted-foreground">
                      <Phone className="h-3 w-3" />{member.phone}
                    </span>
                  )}
                  {member.address && (
                    <span className="flex items-center gap-1 text-[11px] bg-muted/60 rounded px-2 py-0.5 text-muted-foreground truncate max-w-full">
                      <MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{member.address.split(',')[0]}</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <MemberDialog
        open={dialogOpen}
        onClose={() => { setDialog(false); setEditing(null) }}
        initial={editing}
        organizationId={organizationId}
      />
      <ViewDialog member={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

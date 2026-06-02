import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Pencil, Trash2, Users, ChevronRight,
  Building2, ToggleLeft, ToggleRight, Shield, Star, StarOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  useSectors, useSectorWithMembers, useCreateSector,
  useUpdateSector, useDeleteSector,
} from '@/hooks/useSectors'
import {
  useOrgMembers, useAddSectorMember,
  useRemoveSectorMember, useToggleSupervisor,
} from '@/hooks/useSectorMembers'
import {
  useUserPermissions, useUpdateUserPermissions,
  PERMISSION_GROUPS, type PermissionKey
} from '@/hooks/useUserPermissions'
import { cn } from '@/lib/utils'

// ── Cores predefinidas para o setor ─────────────────────────
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
]

// ── Schema do form de setor ──────────────────────────────────
const sectorSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  color: z.string(),
  icon: z.string(),
})
type SectorValues = z.infer<typeof sectorSchema>

// ╔══════════════════════════════════════════════════════════╗
// ║  SectorFormDialog                                        ║
// ╚══════════════════════════════════════════════════════════╝
function SectorFormDialog({
  open, onClose, sector,
}: {
  open: boolean
  onClose: () => void
  sector?: { id: string; name: string; description: string | null; color: string; icon: string }
}) {
  const createSector = useCreateSector()
  const updateSector = useUpdateSector()

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<SectorValues>({
    resolver: zodResolver(sectorSchema),
    defaultValues: {
      name: sector?.name ?? '',
      description: sector?.description ?? '',
      color: sector?.color ?? '#6366f1',
      icon: sector?.icon ?? 'inbox',
    },
  })

  const selectedColor = watch('color')

  const onSubmit = async (values: SectorValues) => {
    if (sector) {
      await updateSector.mutateAsync({ id: sector.id, ...values })
    } else {
      await createSector.mutateAsync(values)
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sector ? 'Editar setor' : 'Novo setor'}</DialogTitle>
          <DialogDescription>
            Setores organizam sua equipe e definem a visibilidade no inbox.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do setor *</Label>
              <Input placeholder="Ex: Vendas, Suporte, Financeiro" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Descreva o propósito deste setor" {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Cor de identificação</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color)}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all ring-offset-2',
                      selectedColor === color ? 'ring-2 ring-primary scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>
              {sector ? 'Salvar' : 'Criar setor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  PermissionsPanel — painel lateral de permissões         ║
// ╚══════════════════════════════════════════════════════════╝
function PermissionsPanel({ userId, userName }: { userId: string; userName: string }) {
  const { data: perms, isLoading } = useUserPermissions(userId)
  const updatePerms = useUpdateUserPermissions(userId)

  if (isLoading) return <p className="text-xs text-muted-foreground p-4">Carregando...</p>
  if (!perms) return <p className="text-xs text-muted-foreground p-4">Sem permissões encontradas.</p>

  const toggle = async (key: PermissionKey) => {
    await updatePerms.mutateAsync({ [key]: !perms[key] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-1">
        <Shield className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Permissões de <span className="text-primary">{userName}</span></p>
      </div>
      {PERMISSION_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{group.label}</p>
          <div className="space-y-2">
            {group.permissions.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary/50 transition-colors">
                <label htmlFor={`perm-${key}`} className="text-sm text-foreground cursor-pointer flex-1">{label}</label>
                <Switch
                  id={`perm-${key}`}
                  checked={perms[key]}
                  onCheckedChange={() => toggle(key)}
                  disabled={updatePerms.isPending}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  MembersDialog — gerenciar membros do setor              ║
// ╚══════════════════════════════════════════════════════════╝
function MembersDialog({
  sectorId, open, onClose,
}: {
  sectorId: string
  open: boolean
  onClose: () => void
}) {
  const { data: sector, isLoading } = useSectorWithMembers(sectorId)
  const { data: orgMembers = [] } = useOrgMembers()
  const addMember = useAddSectorMember()
  const removeMember = useRemoveSectorMember()
  const toggleSupervisor = useToggleSupervisor()
  const [selectedPermUser, setSelectedPermUser] = useState<{ id: string; name: string } | null>(null)

  const memberIds = sector?.sector_members.map(m => m.user_id) ?? []
  const available = orgMembers.filter(m => !memberIds.includes(m.user_id))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: sector?.color ?? '#6366f1' }}
            />
            {sector?.name ?? 'Setor'}
            <Badge variant="muted" className="ml-1">{sector?.sector_members.length ?? 0} membros</Badge>
          </DialogTitle>
          <DialogDescription>Gerencie membros e configure permissões granulares.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5 max-h-[65vh] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              {/* Membros atuais */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Membros atuais</p>
                {sector?.sector_members.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro ainda.</p>
                )}
                <div className="space-y-1">
                  {sector?.sector_members.map(m => {
                    const name = m.profiles?.full_name ?? 'Sem nome'
                    const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/50 group">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={m.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          {m.profiles?.job_title && (
                            <p className="text-xs text-muted-foreground truncate">{m.profiles.job_title}</p>
                          )}
                        </div>
                        {m.is_supervisor && <Badge variant="default" className="text-xs">Supervisor</Badge>}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon-sm"
                            title={m.is_supervisor ? 'Remover supervisor' : 'Tornar supervisor'}
                            onClick={() => toggleSupervisor.mutate({ memberId: m.id, sectorId, isSupervisor: !m.is_supervisor })}
                          >
                            {m.is_supervisor ? <StarOff className="h-3.5 w-3.5 text-warning" /> : <Star className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon-sm"
                            title="Permissões"
                            onClick={() => setSelectedPermUser({ id: m.user_id, name })}
                          >
                            <Shield className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost" size="icon-sm"
                            title="Remover do setor"
                            onClick={() => removeMember.mutate({ memberId: m.id, sectorId })}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Adicionar membros */}
              {available.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Adicionar ao setor</p>
                  <div className="space-y-1">
                    {available.map(m => {
                      const name = m.full_name ?? 'Sem nome'
                      const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                      return (
                        <div key={m.user_id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/50">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={m.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{name}</p>
                            {m.job_title && <p className="text-xs text-muted-foreground truncate">{m.job_title}</p>}
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                          <Button
                            size="sm" variant="outline"
                            loading={addMember.isPending}
                            onClick={() => addMember.mutate({ sectorId, userId: m.user_id })}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Adicionar
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Painel de permissões do membro selecionado */}
              {selectedPermUser && (
                <div className="rounded-xl border border-border bg-card/50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-foreground">Permissões</p>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPermUser(null)}>
                      Fechar
                    </Button>
                  </div>
                  <PermissionsPanel userId={selectedPermUser.id} userName={selectedPermUser.name} />
                </div>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  SectorsPage — principal                                 ║
// ╚══════════════════════════════════════════════════════════╝
export function SectorsPage() {
  const { data: sectors = [], isLoading } = useSectors()
  const updateSector = useUpdateSector()
  const deleteSector = useDeleteSector()

  const [formOpen, setFormOpen] = useState(false)
  const [editSector, setEditSector] = useState<typeof sectors[0] | undefined>()
  const [membersOpen, setMembersOpen] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const openCreate = () => { setEditSector(undefined); setFormOpen(true) }
  const openEdit = (s: typeof sectors[0]) => { setEditSector(s); setFormOpen(true) }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Setores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize sua equipe em setores para controlar visibilidade do inbox e permissões.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo setor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de setores', value: sectors.length, icon: Building2 },
          { label: 'Setores ativos', value: sectors.filter(s => s.is_active).length, icon: ToggleRight },
          { label: 'Inativos', value: sectors.filter(s => !s.is_active).length, icon: ToggleLeft },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista de setores */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : sectors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <p className="font-medium text-foreground">Nenhum setor criado</p>
            <p className="text-sm text-muted-foreground">Crie o primeiro setor para organizar sua equipe.</p>
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Criar primeiro setor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {sectors.length} setor{sectors.length !== 1 ? 'es' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {sectors.map(sector => (
                <div
                  key={sector.id}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-secondary/40 group transition-colors"
                >
                  {/* Cor + nome */}
                  <div
                    className="h-9 w-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: sector.color + '20', borderColor: sector.color + '40', border: '1px solid' }}
                  >
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: sector.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{sector.name}</p>
                      {!sector.is_active && <Badge variant="muted">Inativo</Badge>}
                    </div>
                    {sector.description && (
                      <p className="text-xs text-muted-foreground truncate">{sector.description}</p>
                    )}
                  </div>

                  {/* Ações — visíveis no hover */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setMembersOpen(sector.id)}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Membros
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => updateSector.mutate({ id: sector.id, is_active: !sector.is_active })}
                      title={sector.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {sector.is_active
                        ? <ToggleRight className="h-4 w-4 text-success" />
                        : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      }
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(sector)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => setDeleteConfirm(sector.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <SectorFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        sector={editSector}
      />

      {membersOpen && (
        <MembersDialog
          sectorId={membersOpen}
          open={!!membersOpen}
          onClose={() => setMembersOpen(null)}
        />
      )}

      {/* Confirm delete */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. O setor e seus vínculos de membros serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              loading={deleteSector.isPending}
              onClick={async () => {
                if (deleteConfirm) {
                  await deleteSector.mutateAsync(deleteConfirm)
                  setDeleteConfirm(null)
                }
              }}
            >
              Excluir setor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

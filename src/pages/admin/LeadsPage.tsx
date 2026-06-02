import { useState, useMemo, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Search, SlidersHorizontal, Kanban, List,
  X, User, Phone, Mail, Building2, ChevronDown, Flame
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLeads, useMoveLeadStage, useCreateLead, type LeadWithRelations, type LeadFilters } from '@/hooks/useLeads'
import { useProducts } from '@/hooks/useProducts'
import { usePipelineStages } from '@/hooks/useProducts'
import { useLeadTags } from '@/hooks/useLeadDetails'
import { LeadDetailModal } from '@/pages/admin/leads/LeadDetailModal'
import { cn } from '@/lib/utils'

// ── Score badge ──────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-muted-foreground'
  return (
    <div className={cn('flex items-center gap-1 text-xs font-semibold', color)}>
      <Flame className="h-3 w-3" />
      {score}
    </div>
  )
}

// ── Lead Card (Kanban) ───────────────────────────────────────
function LeadCard({ lead, onClick }: { lead: LeadWithRelations; onClick: () => void }) {
  const initials = lead.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const tags = lead.lead_tag_assignments?.map(a => a.lead_tags).filter(Boolean) ?? []

  return (
    <div
      onClick={onClick}
      className="group rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all space-y-2.5"
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={lead.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{lead.name}</p>
          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
        </div>
        <ScoreBadge score={lead.lead_score} />
      </div>

      {(lead.phone || lead.email) && (
        <div className="space-y-1">
          {lead.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {tags.slice(0, 3).map(tag => (
            <span key={tag.id}
              className="text-[10px] rounded px-1.5 py-0.5 font-medium"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}>
              {tag.name}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {lead.profiles_assigned && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
          <Avatar className="h-4 w-4">
            <AvatarImage src={lead.profiles_assigned.avatar_url ?? undefined} />
            <AvatarFallback className="text-[8px]">
              {lead.profiles_assigned.full_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground truncate">
            {lead.profiles_assigned.full_name}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Kanban Column ────────────────────────────────────────────
function KanbanColumn({
  stage, leads, onLeadClick, onDropLead,
}: {
  stage: { id: string; name: string; color: string; is_won: boolean; is_lost: boolean }
  leads: LeadWithRelations[]
  onLeadClick: (lead: LeadWithRelations) => void
  onDropLead: (leadId: string, stageId: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const totalValue = leads.reduce((acc, l) => {
    return acc // deals value calculado em Módulo 4 completo
  }, 0)

  return (
    <div
      className={cn(
        'flex flex-col w-72 flex-shrink-0 rounded-xl border transition-colors',
        isDragOver ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/20'
      )}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const leadId = e.dataTransfer.getData('leadId')
        if (leadId) onDropLead(leadId, stage.id)
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3 border-b border-border">
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-semibold text-foreground flex-1 truncate">{stage.name}</span>
        <Badge variant="muted" className="text-xs">{leads.length}</Badge>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)]">
        {leads.map(lead => (
          <div
            key={lead.id}
            draggable
            onDragStart={e => e.dataTransfer.setData('leadId', lead.id)}
          >
            <LeadCard lead={lead} onClick={() => onLeadClick(lead)} />
          </div>
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Sem leads neste estágio
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lead List Row ────────────────────────────────────────────
function LeadRow({ lead, onClick }: { lead: LeadWithRelations; onClick: () => void }) {
  const initials = lead.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const tags = lead.lead_tag_assignments?.map(a => a.lead_tags).filter(Boolean) ?? []

  return (
    <div onClick={onClick}
      className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 hover:bg-secondary/30 cursor-pointer group border-b border-border/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={lead.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
        </div>
      </div>
      <div className="min-w-0">
        {lead.phone && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</p>}
        {lead.email && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</p>}
      </div>
      <div>
        {lead.pipeline_stages && (
          <Badge variant="outline" className="text-xs" style={{ borderColor: lead.pipeline_stages.color + '60', color: lead.pipeline_stages.color }}>
            {lead.pipeline_stages.name}
          </Badge>
        )}
      </div>
      <div className="flex gap-1 flex-wrap">
        {tags.slice(0, 2).map(tag => (
          <span key={tag.id} className="text-[10px] rounded px-1.5 py-0.5"
            style={{ backgroundColor: tag.color + '20', color: tag.color }}>
            {tag.name}
          </span>
        ))}
      </div>
      <ScoreBadge score={lead.lead_score} />
    </div>
  )
}

// ── Create Lead Schema ───────────────────────────────────────
const createLeadSchema = z.object({
  name: z.string().min(2, 'Obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  company: z.string().optional(),
  source: z.string(),
  product_id: z.string().optional(),
})
type CreateLeadValues = z.infer<typeof createLeadSchema>

function CreateLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createLead = useCreateLead()
  const { data: products = [] } = useProducts()

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateLeadValues>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { source: 'manual' },
  })

  const productId = watch('product_id')

  const onSubmit = async (values: CreateLeadValues) => {
    await createLead.mutateAsync({
      name: values.name,
      phone: values.phone || undefined,
      email: values.email || undefined,
      company: values.company || undefined,
      source: values.source as LeadWithRelations['source'],
      product_id: values.product_id || undefined,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Adicione manualmente um novo lead ao CRM.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome do lead" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" {...register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" placeholder="email@empresa.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input placeholder="Nome da empresa" {...register('company')} />
              </div>
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select onValueChange={v => setValue('source', v)} defaultValue="manual">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['manual','whatsapp','website','referral','paid','organic','other'].map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Produto / Pipeline</Label>
              <Select onValueChange={v => setValue('product_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem produto</SelectItem>
                  {products.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Criar lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  LeadsPage                                               ║
// ╚══════════════════════════════════════════════════════════╝
export function LeadsPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [filters, setFilters] = useState<LeadFilters>({})
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  const { data: products = [] } = useProducts()
  const { data: tags = [] } = useLeadTags()
  const firstProductId = selectedProductId || products[0]?.id
  const { data: stages = [] } = usePipelineStages(firstProductId)
  const moveLeadStage = useMoveLeadStage()

  const effectiveFilters: LeadFilters = {
    ...filters,
    search: search || undefined,
    productId: selectedProductId || undefined,
  }

  const { data: leads = [], isLoading } = useLeads(effectiveFilters)

  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadWithRelations[]>()
    stages.forEach(s => map.set(s.id, []))
    leads.forEach(l => {
      if (l.current_stage_id && map.has(l.current_stage_id)) {
        map.get(l.current_stage_id)!.push(l)
      }
    })
    return map
  }, [leads, stages])

  const handleDrop = useCallback((leadId: string, toStageId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    if (lead.current_stage_id === toStageId) return
    moveLeadStage.mutate({ leadId, fromStageId: lead.current_stage_id, toStageId })
  }, [leads, moveLeadStage])

  const unstagedLeads = leads.filter(l => !l.current_stage_id)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-foreground">Leads & CRM</h1>
          <p className="text-xs text-muted-foreground">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Busca */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-9 h-8 text-sm" placeholder="Buscar leads..." value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Produto selector */}
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Todos os produtos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os produtos</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(v => !v)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {Object.keys(filters).filter(k => filters[k as keyof LeadFilters]).length > 0 && (
            <Badge variant="default" className="ml-1 text-[10px] h-4 px-1">
              {Object.keys(filters).filter(k => filters[k as keyof LeadFilters]).length}
            </Badge>
          )}
        </Button>

        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setView('kanban')}
            className={cn('p-1.5 transition-colors', view === 'kanban' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-secondary')}>
            <Kanban className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')}
            className={cn('p-1.5 transition-colors', view === 'list' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-secondary')}>
            <List className="h-4 w-4" />
          </button>
        </div>

        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Novo lead
        </Button>
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Score mín.</Label>
            <Input type="number" min={0} max={100} className="w-20 h-7 text-xs"
              value={filters.minScore ?? ''} placeholder="0"
              onChange={e => setFilters(f => ({ ...f, minScore: e.target.value ? parseInt(e.target.value) : undefined }))} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Origem</Label>
            <Select value={filters.source ?? ''} onValueChange={v => setFilters(f => ({ ...f, source: v || undefined }))}>
              <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                {['manual','whatsapp','website','referral','paid','organic','form','funnel'].map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Tags</Label>
            <div className="flex gap-1 flex-wrap max-w-64">
              {tags.map(tag => {
                const active = filters.tagIds?.includes(tag.id)
                return (
                  <button key={tag.id}
                    onClick={() => setFilters(f => ({
                      ...f,
                      tagIds: active
                        ? f.tagIds?.filter(t => t !== tag.id)
                        : [...(f.tagIds ?? []), tag.id],
                    }))}
                    className={cn('text-[10px] rounded px-1.5 py-0.5 border transition-all',
                      active ? 'opacity-100' : 'opacity-50 hover:opacity-75')}
                    style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}>
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto text-xs"
            onClick={() => setFilters({})}>
            <X className="h-3 w-3" /> Limpar
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full">
            {stages.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage.get(stage.id) ?? []}
                onLeadClick={setSelectedLead}
                onDropLead={handleDrop}
              />
            ))}

            {/* Leads sem stage */}
            {unstagedLeads.length > 0 && stages.length === 0 && (
              <div className="flex flex-col w-72 flex-shrink-0 rounded-xl border border-border bg-muted/20">
                <div className="p-3 border-b border-border">
                  <span className="text-sm font-semibold text-muted-foreground">Sem pipeline</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {unstagedLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                  ))}
                </div>
              </div>
            )}

            {stages.length === 0 && unstagedLeads.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                <p className="text-muted-foreground text-sm">Selecione um produto com pipeline para visualizar o Kanban.</p>
                <p className="text-xs text-muted-foreground">Ou crie seu primeiro lead clicando em "+ Novo lead".</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Header list */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 px-4 py-2 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Lead</span><span>Contato</span><span>Estágio</span><span>Tags</span><span>Score</span>
          </div>
          {leads.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <User className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Criar lead
              </Button>
            </div>
          ) : (
            leads.map(lead => <LeadRow key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />)
          )}
        </div>
      )}

      {/* Modais */}
      <CreateLeadDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {selectedLead && (
        <LeadDetailModal
          leadId={selectedLead.id}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  )
}

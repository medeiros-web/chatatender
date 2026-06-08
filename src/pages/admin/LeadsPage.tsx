import { useState, useMemo, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Search, Kanban, List, X, Phone, Mail,
  Flame, ArrowUpDown, ArrowUp, ArrowDown,
  Trash2, UserCheck, Tag, TrendingUp, Users,
  Star, Clock, Calendar, LayoutGrid, ChevronRight,
  MessageCircle, SlidersHorizontal, Filter,
  CheckCircle2, XCircle, Zap, Eye,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLeads, useMoveLeadStage, useCreateLead, useDeleteLead, type LeadWithRelations, type LeadFilters } from '@/hooks/useLeads'
import { useProducts, usePipelineStages } from '@/hooks/useProducts'
import { useLeadTags } from '@/hooks/useLeadDetails'
import { LeadDetailModal } from '@/pages/admin/leads/LeadDetailModal'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Helpers ──────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', whatsapp: 'WhatsApp', website: 'Site',
  referral: 'Indicação', paid: 'Pago', organic: 'Orgânico',
  form: 'Formulário', funnel: 'Funil',
}

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: '#25D366', paid: '#FF6B35', referral: '#8B5CF6',
  website: '#3B82F6', organic: '#10B981', form: '#F59E0B',
  funnel: '#EC4899', manual: '#94A3B8',
}

function scoreColor(score: number) {
  if (score >= 70) return '#22C55E'
  if (score >= 40) return '#F59E0B'
  return '#94A3B8'
}

function scoreLabel(score: number) {
  if (score >= 70) return 'Quente'
  if (score >= 40) return 'Morno'
  return 'Frio'
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── KPI Cards ─────────────────────────────────────────────────
function KpiBar({ leads, stages }: { leads: LeadWithRelations[]; stages: { id: string; is_won: boolean }[] }) {
  const total = leads.length
  const hot = leads.filter(l => l.lead_score >= 70).length
  const withStage = leads.filter(l => l.current_stage_id).length
  const wonStageIds = new Set(stages.filter(s => s.is_won).map(s => s.id))
  const won = leads.filter(l => l.current_stage_id && wonStageIds.has(l.current_stage_id)).length
  const conv = total > 0 ? ((won / total) * 100).toFixed(1) : '0'

  const kpis = [
    { icon: Users, label: 'Total leads', value: total, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Flame, label: 'Quentes', value: hot, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { icon: LayoutGrid, label: 'No pipeline', value: withStage, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: CheckCircle2, label: 'Conversão', value: `${conv}%`, color: 'text-green-500', bg: 'bg-green-500/10' },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-border bg-card/30 flex-shrink-0">
      {kpis.map(k => (
        <div key={k.label} className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-2.5">
          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', k.bg)}>
            <k.icon className={cn('h-4 w-4', k.color)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-lg font-bold text-foreground leading-tight">{k.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Lead Card (Kanban) ───────────────────────────────────────
function LeadCard({
  lead, onClick, onDragStart,
}: {
  lead: LeadWithRelations
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const tags = lead.lead_tag_assignments?.map(a => a.lead_tags).filter(Boolean) ?? []
  const sc = scoreColor(lead.lead_score)
  const lastContact = lead.last_contact_at
    ? formatDistanceToNow(new Date(lead.last_contact_at), { locale: ptBR, addSuffix: true })
    : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group relative rounded-xl border border-border bg-card cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
    >
      {/* Score accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ backgroundColor: sc }} />

      <div className="pl-3 pr-3 pt-3 pb-2.5 space-y-2">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
            <AvatarImage src={lead.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">{initials(lead.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{lead.name}</p>
            {lead.company && (
              <p className="text-[11px] text-muted-foreground truncate">{lead.company}</p>
            )}
          </div>
          {/* Score pill */}
          <div className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 flex-shrink-0"
            style={{ backgroundColor: sc + '20' }}>
            <Flame className="h-2.5 w-2.5" style={{ color: sc }} />
            <span className="text-[10px] font-bold" style={{ color: sc }}>{lead.lead_score}</span>
          </div>
        </div>

        {/* Contact */}
        {(lead.phone || lead.email) && (
          <div className="space-y-0.5">
            {lead.phone && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Phone className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Mail className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.slice(0, 2).map(tag => (
              <span key={tag.id} className="text-[10px] rounded-full px-2 py-0.5 font-medium"
                style={{ backgroundColor: tag.color + '25', color: tag.color }}>
                {tag.name}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground rounded-full px-1.5 py-0.5 bg-muted">
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          {lead.source && (
            <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5"
              style={{
                backgroundColor: (SOURCE_COLORS[lead.source] ?? '#94a3b8') + '20',
                color: SOURCE_COLORS[lead.source] ?? '#94a3b8',
              }}>
              {SOURCE_LABELS[lead.source] ?? lead.source}
            </span>
          )}
          {lastContact && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {lastContact}
            </span>
          )}
        </div>
      </div>

      {/* Hover quick actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {lead.phone && (
          <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="h-5 w-5 rounded flex items-center justify-center bg-[#25D366]/20 hover:bg-[#25D366]/40 transition-colors">
            <MessageCircle className="h-3 w-3 text-[#25D366]" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Kanban Column ────────────────────────────────────────────
function KanbanColumn({
  stage, leads, onLeadClick, onDropLead, onQuickAdd,
}: {
  stage: { id: string; name: string; color: string; is_won: boolean; is_lost: boolean; probability?: number }
  leads: LeadWithRelations[]
  onLeadClick: (lead: LeadWithRelations) => void
  onDropLead: (leadId: string, stageId: string) => void
  onQuickAdd: (stageId: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const avgScore = leads.length > 0
    ? Math.round(leads.reduce((a, l) => a + l.lead_score, 0) / leads.length)
    : 0

  const colBg = stage.is_won
    ? 'bg-green-500/5 border-green-500/20'
    : stage.is_lost
    ? 'bg-red-500/5 border-red-500/20'
    : isDragOver
    ? 'bg-primary/5 border-primary/40'
    : 'bg-muted/10 border-border'

  return (
    <div
      className={cn('flex flex-col w-[270px] flex-shrink-0 rounded-xl border transition-all', colBg)}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const leadId = e.dataTransfer.getData('leadId')
        if (leadId) onDropLead(leadId, stage.id)
      }}
    >
      {/* Column header accent */}
      <div className="h-1 rounded-t-xl w-full" style={{ backgroundColor: stage.color }} />

      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-bold text-foreground flex-1 truncate uppercase tracking-wide">{stage.name}</span>
        <div className="flex items-center gap-1.5">
          {stage.is_won && <CheckCircle2 className="h-3 w-3 text-green-500" />}
          {stage.is_lost && <XCircle className="h-3 w-3 text-red-500" />}
          <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {leads.length}
          </span>
        </div>
      </div>

      {/* Score stats */}
      {leads.length > 0 && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${avgScore}%`, backgroundColor: scoreColor(avgScore) }} />
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">ø{avgScore}</span>
        </div>
      )}

      {/* Cards */}
      <div className={cn(
        'flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-360px)]',
        isDragOver && leads.length === 0 && 'border-2 border-dashed border-primary/40 rounded-lg m-2',
      )}>
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
            onDragStart={e => e.dataTransfer.setData('leadId', lead.id)}
          />
        ))}
        {leads.length === 0 && (
          <div className={cn(
            'flex flex-col items-center justify-center h-20 rounded-xl transition-all',
            isDragOver
              ? 'bg-primary/10 border-2 border-dashed border-primary/50'
              : 'border-2 border-dashed border-border/50'
          )}>
            <p className="text-[10px] text-muted-foreground">
              {isDragOver ? 'Soltar aqui' : 'Sem leads'}
            </p>
          </div>
        )}
      </div>

      {/* Quick add */}
      <div className="p-2">
        <button
          onClick={() => onQuickAdd(stage.id)}
          className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Adicionar lead
        </button>
      </div>
    </div>
  )
}

// ── Table View ───────────────────────────────────────────────
type SortField = 'name' | 'company' | 'lead_score' | 'last_contact_at' | 'created_at' | 'source'
type SortDir = 'asc' | 'desc'

function TableView({
  leads,
  onLeadClick,
  onDeleteLead,
}: {
  leads: LeadWithRelations[]
  onLeadClick: (lead: LeadWithRelations) => void
  onDeleteLead: (id: string) => void
}) {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'created_at', dir: 'desc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStage, setBulkStage] = useState(false)

  const toggleSort = (field: SortField) => {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })
  }

  const sorted = useMemo(() => [...leads].sort((a, b) => {
    const mult = sort.dir === 'asc' ? 1 : -1
    const va = (a as unknown as Record<string, unknown>)[sort.field] ?? ''
    const vb = (b as unknown as Record<string, unknown>)[sort.field] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
    return String(va).localeCompare(String(vb)) * mult
  }), [leads, sort])

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(leads.map(l => l.id)) : new Set())
  }

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sort.dir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />
  }

  const ColHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      className={cn('px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap group', className)}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1.5 hover:text-foreground transition-colors">
        {label}
        <SortIcon field={field} />
      </div>
    </th>
  )

  const hasSelection = selected.size > 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">{selected.size}</span>
            </div>
            <span className="text-sm font-medium text-foreground">selecionado{selected.size !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
            onClick={() => { /* move stage */ }}>
            <Tag className="h-3 w-3" /> Mover estágio
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
            onClick={() => { /* assign */ }}>
            <UserCheck className="h-3 w-3" /> Atribuir
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
            onClick={() => {
              selected.forEach(id => onDeleteLead(id))
              setSelected(new Set())
            }}>
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto"
            onClick={() => setSelected(new Set())}>
            <X className="h-3 w-3" /> Limpar seleção
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
            <tr>
              <th className="px-3 py-2.5 w-10">
                <Checkbox
                  checked={selected.size === leads.length && leads.length > 0}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
              </th>
              <ColHeader field="name" label="Lead" className="min-w-[180px]" />
              <ColHeader field="company" label="Empresa" className="min-w-[140px]" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Estágio
              </th>
              <ColHeader field="lead_score" label="Score" />
              <ColHeader field="source" label="Origem" />
              <ColHeader field="last_contact_at" label="Último contato" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Tags
              </th>
              <th className="px-3 py-2.5 w-16 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
            {sorted.map((lead, i) => {
              const tags = lead.lead_tag_assignments?.map(a => a.lead_tags).filter(Boolean) ?? []
              const sc = scoreColor(lead.lead_score)
              const isSelected = selected.has(lead.id)

              return (
                <tr
                  key={lead.id}
                  onClick={() => onLeadClick(lead)}
                  className={cn(
                    'group border-b border-border/50 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/5'
                      : i % 2 === 0 ? 'bg-card' : 'bg-muted/20',
                    'hover:bg-secondary/40',
                  )}
                >
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(lead.id)} />
                  </td>

                  {/* Name + Avatar */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={lead.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{initials(lead.name)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card"
                          style={{ backgroundColor: sc }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm leading-tight truncate">{lead.name}</p>
                        {lead.job_title && <p className="text-[11px] text-muted-foreground truncate">{lead.job_title}</p>}
                      </div>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-3 py-2.5">
                    <p className="text-sm text-foreground truncate max-w-[160px]">{lead.company ?? '—'}</p>
                    {lead.phone && (
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />{lead.phone}
                      </p>
                    )}
                  </td>

                  {/* Stage */}
                  <td className="px-3 py-2.5">
                    {lead.pipeline_stages ? (
                      <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-medium"
                        style={{
                          backgroundColor: lead.pipeline_stages.color + '20',
                          color: lead.pipeline_stages.color,
                        }}>
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: lead.pipeline_stages.color }} />
                        {lead.pipeline_stages.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sem estágio</span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${lead.lead_score}%`, backgroundColor: sc }} />
                      </div>
                      <span className="text-xs font-mono font-semibold" style={{ color: sc }}>
                        {lead.lead_score}
                      </span>
                    </div>
                  </td>

                  {/* Source */}
                  <td className="px-3 py-2.5">
                    {lead.source ? (
                      <span className="text-[11px] rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: (SOURCE_COLORS[lead.source] ?? '#94a3b8') + '20',
                          color: SOURCE_COLORS[lead.source] ?? '#94a3b8',
                        }}>
                        {SOURCE_LABELS[lead.source] ?? lead.source}
                      </span>
                    ) : '—'}
                  </td>

                  {/* Last contact */}
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                    {lead.last_contact_at
                      ? formatDistanceToNow(new Date(lead.last_contact_at), { locale: ptBR, addSuffix: true })
                      : lead.created_at
                      ? formatDistanceToNow(new Date(lead.created_at), { locale: ptBR, addSuffix: true })
                      : '—'}
                  </td>

                  {/* Tags */}
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {tags.slice(0, 2).map(tag => (
                        <span key={tag.id} className="text-[10px] rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap"
                          style={{ backgroundColor: tag.color + '25', color: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                      {tags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary transition-colors"
                            onClick={() => onLeadClick(lead)}>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Ver detalhes</TooltipContent>
                      </Tooltip>
                      {lead.phone && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-6 w-6 rounded flex items-center justify-center hover:bg-[#25D366]/20 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="left">WhatsApp</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 transition-colors"
                            onClick={() => { if (confirm('Excluir lead?')) onDeleteLead(lead.id) }}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Excluir</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Table footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/50 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {sorted.length} lead{sorted.length !== 1 ? 's' : ''} · {selected.size > 0 ? `${selected.size} selecionado${selected.size !== 1 ? 's' : ''}` : 'Clique para selecionar'}
        </span>
        <span className="text-xs text-muted-foreground">
          Score médio: <strong>{sorted.length > 0 ? Math.round(sorted.reduce((a, l) => a + l.lead_score, 0) / sorted.length) : 0}</strong>
        </span>
      </div>
    </div>
  )
}

// ── Create Lead Form ─────────────────────────────────────────
const createLeadSchema = z.object({
  name: z.string().min(2, 'Obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  company: z.string().optional(),
  source: z.string(),
  product_id: z.string().optional(),
  stage_id: z.string().optional(),
})
type CreateLeadValues = z.infer<typeof createLeadSchema>

function CreateLeadDialog({
  open, onClose, defaultStageId,
}: {
  open: boolean
  onClose: () => void
  defaultStageId?: string
}) {
  const createLead = useCreateLead()
  const { data: products = [] } = useProducts()
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateLeadValues>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { source: 'manual', stage_id: defaultStageId },
  })

  const productId = watch('product_id')
  const { data: stages = [] } = usePipelineStages(productId)

  const onSubmit = async (values: CreateLeadValues) => {
    await createLead.mutateAsync({
      name: values.name,
      phone: values.phone || undefined,
      email: values.email || undefined,
      company: values.company || undefined,
      source: values.source as LeadWithRelations['source'],
      product_id: values.product_id || undefined,
      current_stage_id: values.stage_id || undefined,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Adicione um novo lead ao CRM.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome do lead" {...register('name')} autoFocus />
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
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Produto / Pipeline</Label>
                <Select onValueChange={v => { setValue('product_id', v === '__none__' ? '' : v); setValue('stage_id', '') }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem produto</SelectItem>
                    {products.filter(p => p.is_active).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {stages.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Estágio inicial</Label>
                  <Select defaultValue={defaultStageId} onValueChange={v => setValue('stage_id', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem estágio</SelectItem>
                      {stages.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>
              <Plus className="h-3.5 w-3.5" /> Criar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Quick Filter Chips ────────────────────────────────────────
function FilterChips({
  filters, tags, onFiltersChange,
}: {
  filters: LeadFilters
  tags: { id: string; name: string; color: string }[]
  onFiltersChange: (f: LeadFilters) => void
}) {
  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== '').length

  const sources = ['whatsapp', 'website', 'paid', 'referral', 'organic'] as const

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Score quick filters */}
      <button
        onClick={() => onFiltersChange({ ...filters, minScore: filters.minScore === 70 ? undefined : 70 })}
        className={cn(
          'flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-all',
          filters.minScore === 70
            ? 'bg-orange-500/10 border-orange-500/40 text-orange-600 font-semibold'
            : 'border-border text-muted-foreground hover:border-orange-500/40 hover:text-orange-500',
        )}>
        <Flame className="h-3 w-3" /> Quentes
      </button>

      {/* Source chips */}
      {sources.map(src => (
        <button
          key={src}
          onClick={() => onFiltersChange({ ...filters, source: filters.source === src ? undefined : src })}
          className={cn(
            'text-xs rounded-full px-3 py-1 border transition-all',
            filters.source === src
              ? 'font-semibold border-transparent'
              : 'border-border text-muted-foreground hover:border-primary/40',
          )}
          style={filters.source === src ? {
            backgroundColor: (SOURCE_COLORS[src] ?? '#94a3b8') + '20',
            borderColor: (SOURCE_COLORS[src] ?? '#94a3b8') + '60',
            color: SOURCE_COLORS[src] ?? '#94a3b8',
          } : {}}>
          {SOURCE_LABELS[src]}
        </button>
      ))}

      {/* Tag chips */}
      {tags.slice(0, 4).map(tag => {
        const active = filters.tagIds?.includes(tag.id)
        return (
          <button
            key={tag.id}
            onClick={() => onFiltersChange({
              ...filters,
              tagIds: active
                ? filters.tagIds?.filter(t => t !== tag.id)
                : [...(filters.tagIds ?? []), tag.id],
            })}
            className={cn(
              'text-xs rounded-full px-3 py-1 border transition-all font-medium',
              active ? 'opacity-100' : 'opacity-50 hover:opacity-75',
            )}
            style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '50' }}>
            {tag.name}
          </button>
        )
      })}

      {activeCount > 0 && (
        <button
          onClick={() => onFiltersChange({})}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-1">
          <X className="h-3 w-3" /> Limpar
        </button>
      )}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  LeadsPage                                               ║
// ╚══════════════════════════════════════════════════════════╝
export function LeadsPage() {
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [filters, setFilters] = useState<LeadFilters>({})
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createStageId, setCreateStageId] = useState<string | undefined>()
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  const { data: products = [] } = useProducts()
  const { data: tags = [] } = useLeadTags()
  const firstProductId = selectedProductId || products[0]?.id
  const { data: stages = [] } = usePipelineStages(firstProductId)
  const moveLeadStage = useMoveLeadStage()
  const deleteLead = useDeleteLead()

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
    if (!lead || lead.current_stage_id === toStageId) return
    moveLeadStage.mutate({ leadId, fromStageId: lead.current_stage_id, toStageId })
  }, [leads, moveLeadStage])

  const handleQuickAdd = (stageId: string) => {
    setCreateStageId(stageId)
    setCreateOpen(true)
  }

  const unstagedLeads = leads.filter(l => !l.current_stage_id)

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* KPI Bar */}
      <KpiBar leads={leads} stages={stages} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card/60 flex-shrink-0">
        <div className="flex-1 flex items-center gap-3">
          <h1 className="font-display text-lg font-bold text-foreground whitespace-nowrap">Leads & Pipeline</h1>

          {/* Product tabs */}
          {products.length > 0 && (
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border border-border">
              <button
                onClick={() => setSelectedProductId('')}
                className={cn(
                  'text-xs rounded-md px-2.5 py-1 transition-all font-medium',
                  !selectedProductId ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}>
                Todos
              </button>
              {products.slice(0, 4).map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className={cn(
                    'text-xs rounded-md px-2.5 py-1 transition-all font-medium',
                    selectedProductId === p.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Buscar leads..." value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setView('kanban')}
                className={cn('px-2.5 py-1.5 transition-colors', view === 'kanban' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-secondary')}>
                <Kanban className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Kanban</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setView('table')}
                className={cn('px-2.5 py-1.5 transition-colors', view === 'table' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-secondary')}>
                <List className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Tabela</TooltipContent>
          </Tooltip>
        </div>

        <Button size="sm" onClick={() => { setCreateStageId(undefined); setCreateOpen(true) }}>
          <Plus className="h-3.5 w-3.5" /> Novo lead
        </Button>
      </div>

      {/* Filter chips */}
      <div className="px-6 py-2 border-b border-border/50 bg-card/30 flex-shrink-0">
        <FilterChips filters={filters} tags={tags} onFiltersChange={setFilters} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 overflow-x-auto p-6">
          {stages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Kanban className="h-8 w-8 text-primary/60" />
              </div>
              <div>
                <p className="text-foreground font-semibold">Nenhum pipeline configurado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione um produto com pipeline ou crie estágios em Produtos.
                </p>
              </div>
              {unstagedLeads.length > 0 && (
                <p className="text-xs text-muted-foreground">{unstagedLeads.length} lead(s) sem estágio</p>
              )}
            </div>
          ) : (
            <div className="flex gap-3 h-full items-start">
              {stages.map(stage => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsByStage.get(stage.id) ?? []}
                  onLeadClick={setSelectedLead}
                  onDropLead={handleDrop}
                  onQuickAdd={handleQuickAdd}
                />
              ))}

              {/* Sem stage */}
              {unstagedLeads.length > 0 && (
                <div className="flex flex-col w-[270px] flex-shrink-0 rounded-xl border border-dashed border-border bg-muted/5">
                  <div className="h-1 rounded-t-xl bg-muted" />
                  <div className="px-3 py-2.5 border-b border-border/50">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Sem estágio</span>
                    <span className="ml-2 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{unstagedLeads.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-360px)]">
                    {unstagedLeads.map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => setSelectedLead(lead)}
                        onDragStart={e => e.dataTransfer.setData('leadId', lead.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <TableView
          leads={leads}
          onLeadClick={setSelectedLead}
          onDeleteLead={id => deleteLead.mutate(id)}
        />
      )}

      {/* Modais */}
      <CreateLeadDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultStageId={createStageId}
      />

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

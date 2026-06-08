import { useState, useRef } from 'react'
import { MessageSquare, Search, Phone, Mail, Flame, ExternalLink, User, Star, Plus, Activity, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLeads, useMoveLeadStage, type LeadWithRelations } from '@/hooks/useLeads'
import { LeadDetailModal } from '@/pages/admin/leads/LeadDetailModal'
import { cn } from '@/lib/utils'

// ── WhatsApp helpers ────────────────────────────────────────────────────────

function waLink(phone: string | null) {
  if (!phone) return 'https://web.whatsapp.com'
  const digits = phone.replace(/\D/g, '')
  const num = digits.startsWith('55') ? digits : `55${digits}`
  return `https://web.whatsapp.com/send?phone=${num}`
}

// ── Qualification badge ──────────────────────────────────────────────────────

function QualBadge({ score }: { score: number }) {
  const label = score >= 70 ? 'Quente' : score >= 40 ? 'Morno' : 'Frio'
  const cls = score >= 70
    ? 'bg-red-100 text-red-600'
    : score >= 40
    ? 'bg-amber-100 text-amber-600'
    : 'bg-slate-100 text-slate-500'
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5', cls)}>
      <Flame className="h-2.5 w-2.5" />
      {label} {score}
    </span>
  )
}

// ── BANT mini-bar ────────────────────────────────────────────────────────────

function BantBar({ score }: { score: number }) {
  const pct = Math.min(100, score)
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-300'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">BANT</span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-muted-foreground">{pct}%</span>
    </div>
  )
}

// ── CRM Lead Card ────────────────────────────────────────────────────────────

function CrmCard({
  lead,
  onClick,
  onDragStart,
}: {
  lead: LeadWithRelations
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const initials = lead.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const tags = lead.lead_tag_assignments?.map(a => a.lead_tags).filter(Boolean) ?? []

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group rounded-xl border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-md transition-all space-y-2.5 select-none"
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={lead.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight truncate">{lead.name}</p>
          {lead.company && <p className="text-[10px] text-muted-foreground truncate">{lead.company}</p>}
        </div>
        <QualBadge score={lead.lead_score} />
      </div>

      {/* BANT */}
      {lead.bant_score > 0 && <BantBar score={lead.bant_score} />}

      {/* Contacts */}
      <div className="flex items-center gap-1.5">
        {lead.phone && (
          <a
            href={waLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title={`Abrir WhatsApp: ${lead.phone}`}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            WhatsApp
          </a>
        )}
        {lead.phone && (
          <span className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
            <Phone className="h-2.5 w-2.5" />{lead.phone}
          </span>
        )}
        {!lead.phone && lead.email && (
          <span className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
            <Mail className="h-2.5 w-2.5" />{lead.email}
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {tags.slice(0, 3).map(tag => (
            <span key={tag.id}
              className="text-[9px] rounded px-1.5 py-0.5 font-medium"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}>
              {tag.name}
            </span>
          ))}
          {tags.length > 3 && <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>}
        </div>
      )}

      {/* Assignee */}
      {lead.profiles_assigned && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px]">{lead.profiles_assigned.full_name?.[0]}</AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground truncate">{lead.profiles_assigned.full_name}</span>
        </div>
      )}
    </div>
  )
}

// ── Kanban Column ────────────────────────────────────────────────────────────

function CrmColumn({
  stage, leads, onLeadClick, onDropLead,
}: {
  stage: { id: string; name: string; color: string; is_won: boolean; is_lost: boolean }
  leads: LeadWithRelations[]
  onLeadClick: (lead: LeadWithRelations) => void
  onDropLead: (leadId: string, stageId: string) => void
}) {
  const [over, setOver] = useState(false)
  const dragCount = useRef(0)

  const hotLeads = leads.filter(l => l.lead_score >= 70).length
  const warmLeads = leads.filter(l => l.lead_score >= 40 && l.lead_score < 70).length
  const waLeads = leads.filter(l => !!l.phone).length

  return (
    <div
      className={cn(
        'flex flex-col w-72 flex-shrink-0 rounded-xl border transition-all duration-150',
        over ? 'border-primary/60 bg-primary/5 shadow-md' : 'border-border bg-muted/20'
      )}
      onDragOver={e => { e.preventDefault() }}
      onDragEnter={() => { dragCount.current++; setOver(true) }}
      onDragLeave={() => { dragCount.current--; if (dragCount.current === 0) setOver(false) }}
      onDrop={e => {
        e.preventDefault()
        dragCount.current = 0
        setOver(false)
        const leadId = e.dataTransfer.getData('leadId')
        if (leadId) onDropLead(leadId, stage.id)
      }}
    >
      {/* Column header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
          <span className="text-sm font-semibold text-foreground flex-1 truncate">{stage.name}</span>
          <span className="text-xs text-muted-foreground font-medium">{leads.length}</span>
        </div>
        {/* Mini stats */}
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          {hotLeads > 0 && <span className="text-red-500 font-medium">{hotLeads} quente{hotLeads > 1 ? 's' : ''}</span>}
          {warmLeads > 0 && <span className="text-amber-500 font-medium">{warmLeads} morno{warmLeads > 1 ? 's' : ''}</span>}
          {waLeads > 0 && <span className="text-emerald-600 font-medium">{waLeads} WA</span>}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-320px)]">
        {leads.map(lead => (
          <CrmCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
            onDragStart={e => { e.dataTransfer.setData('leadId', lead.id) }}
          />
        ))}
        {leads.length === 0 && (
          <div className={cn(
            'flex flex-col items-center justify-center h-16 rounded-lg border-2 border-dashed transition-colors text-xs text-muted-foreground gap-1',
            over ? 'border-primary/40 text-primary' : 'border-border/50'
          )}>
            <Plus className="h-4 w-4" />
            {over ? 'Soltar aqui' : 'Vazio'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Activity sidebar ─────────────────────────────────────────────────────────

function ActivitySidebar({ lead, onClose }: { lead: LeadWithRelations; onClose: () => void }) {
  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-card flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Atividade rápida</span>
        </div>
        <button onClick={onClose} className="hover:bg-accent rounded p-1 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{lead.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{lead.name}</p>
            {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
          </div>
        </div>

        <QualBadge score={lead.lead_score} />

        {lead.pipeline_stages && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: lead.pipeline_stages.color }} />
            <span className="text-xs text-muted-foreground">{lead.pipeline_stages.name}</span>
          </div>
        )}
      </div>

      {/* Ações rápidas */}
      <div className="p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ações rápidas</p>

        {lead.phone && (
          <a
            href={waLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Abrir no WhatsApp Web
            <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-70" />
          </a>
        )}

        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-sm font-medium transition-colors"
          >
            <Phone className="h-4 w-4" />
            Ligar
          </a>
        )}

        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 bg-muted hover:bg-accent text-sm font-medium transition-colors"
          >
            <Mail className="h-4 w-4" />
            Enviar e-mail
          </a>
        )}
      </div>

      {/* BANT qualificação */}
      <div className="p-4 border-t border-border space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qualificação BANT</p>
        {[
          { key: 'Budget', val: lead.bant_budget },
          { key: 'Authority', val: lead.bant_authority },
          { key: 'Need', val: lead.bant_need },
          { key: 'Timeline', val: lead.bant_timeline },
        ].map(({ key, val }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{key}</span>
            <Badge variant="outline" className="text-[10px]">
              {val ?? 'Não avaliado'}
            </Badge>
          </div>
        ))}
        <BantBar score={lead.bant_score} />
      </div>

      <div className="p-4 mt-auto border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">
          Clique no card para abrir o perfil completo
        </p>
      </div>
    </div>
  )
}

// ── Main CRM Page ────────────────────────────────────────────────────────────

export function CrmPage() {
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null)
  const [detailLead, setDetailLead] = useState<LeadWithRelations | null>(null)

  const { data: leads = [] } = useLeads({ isArchived: false })
  const moveLead = useMoveLeadStage()

  const filteredLeads = leads.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search) ||
    l.company?.toLowerCase().includes(search.toLowerCase())
  )

  // Derive unique stages from lead data (already joined in useLeads query)
  const stages = Object.values(
    leads.reduce<Record<string, { id: string; name: string; color: string; position: number; is_won: boolean; is_lost: boolean }>>(
      (acc, l) => {
        if (l.pipeline_stages && !acc[l.pipeline_stages.id]) {
          acc[l.pipeline_stages.id] = l.pipeline_stages
        }
        return acc
      }, {}
    )
  ).sort((a, b) => a.position - b.position)

  const stageMap = stages.reduce<Record<string, LeadWithRelations[]>>((acc, s) => {
    acc[s.id] = filteredLeads.filter(l => l.current_stage_id === s.id)
    return acc
  }, {})

  const unassigned = filteredLeads.filter(l => !l.current_stage_id)

  const totalWa = leads.filter(l => !!l.phone).length
  const hotCount = leads.filter(l => l.lead_score >= 70).length
  const bantAvg = leads.length > 0
    ? Math.round(leads.reduce((acc, l) => acc + l.bant_score, 0) / leads.length)
    : 0

  function handleDrop(leadId: string, toStageId: string) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.current_stage_id === toStageId) return
    moveLead.mutate({ leadId, fromStageId: lead.current_stage_id, toStageId })
  }

  function handleCardClick(lead: LeadWithRelations) {
    setSelectedLead(prev => prev?.id === lead.id ? null : lead)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">CRM WhatsApp</h1>
              <p className="text-xs text-muted-foreground">Gerencie leads e inicie conversas diretamente no WhatsApp</p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              >
                <MessageSquare className="h-4 w-4" />
                Abrir WhatsApp Web
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{leads.length}</span>
              <span className="text-muted-foreground">leads</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-foreground">{totalWa}</span>
              <span className="text-muted-foreground">com WhatsApp</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-foreground">{hotCount}</span>
              <span className="text-muted-foreground">quentes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-foreground">{bantAvg}%</span>
              <span className="text-muted-foreground">BANT médio</span>
            </div>

            <div className="ml-auto relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar lead, telefone, empresa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full items-start">
            {stages.map(stage => (
              <CrmColumn
                key={stage.id}
                stage={stage}
                leads={stageMap[stage.id] ?? []}
                onLeadClick={handleCardClick}
                onDropLead={handleDrop}
              />
            ))}

            {unassigned.length > 0 && (
              <CrmColumn
                stage={{ id: '', name: 'Sem estágio', color: '#94a3b8', is_won: false, is_lost: false }}
                leads={unassigned}
                onLeadClick={handleCardClick}
                onDropLead={handleDrop}
              />
            )}
          </div>
        </div>
      </div>

      {/* Activity sidebar */}
      {selectedLead && (
        <ActivitySidebar
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}

      {/* Full detail modal */}
      {detailLead && (
        <LeadDetailModal
          leadId={detailLead.id}
          open={!!detailLead}
          onClose={() => setDetailLead(null)}
        />
      )}
    </div>
  )
}

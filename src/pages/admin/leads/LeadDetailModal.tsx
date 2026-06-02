import { useState } from 'react'
import {
  Phone, Mail, Building2, User, MapPin, Globe, Tag,
  Plus, Trash2, Pin, Clock, CheckCircle2, XCircle,
  Flame, ArrowRight, DollarSign, Calendar, MessageSquare,
  Pencil, Check, X
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useLead, useUpdateLead } from '@/hooks/useLeads'
import {
  useLeadNotes, useCreateNote, useDeleteNote,
  useLeadTags, useAssignTag, useRemoveTag,
  useLeadTasks, useCreateTask, useUpdateTask,
  useLeadDeals, useCreateDeal,
  useLeadTimeline,
} from '@/hooks/useLeadDetails'

// ── BANT: 17 perguntas em 4 dimensões ────────────────────────
const BANT_QUESTIONS = [
  // Budget (0-4)
  { id: 'b1', dim: 'Budget', label: 'Qual o orçamento disponível?' },
  { id: 'b2', dim: 'Budget', label: 'O orçamento já foi aprovado?' },
  { id: 'b3', dim: 'Budget', label: 'Quem controla o orçamento?' },
  { id: 'b4', dim: 'Budget', label: 'Há concorrência interna por verba?' },
  // Authority (4-7)
  { id: 'a1', dim: 'Authority', label: 'Você é o decisor final?' },
  { id: 'a2', dim: 'Authority', label: 'Quem mais participa da decisão?' },
  { id: 'a3', dim: 'Authority', label: 'Qual é o processo de aprovação?' },
  // Need (7-12)
  { id: 'n1', dim: 'Need', label: 'Qual problema precisa resolver?' },
  { id: 'n2', dim: 'Need', label: 'Qual o impacto do problema atual?' },
  { id: 'n3', dim: 'Need', label: 'Já tentou outras soluções?' },
  { id: 'n4', dim: 'Need', label: 'Qual o nível de urgência (1-10)?' },
  { id: 'n5', dim: 'Need', label: 'Quais são os critérios de sucesso?' },
  // Timeline (12-17)
  { id: 't1', dim: 'Timeline', label: 'Quando precisa estar implementado?' },
  { id: 't2', dim: 'Timeline', label: 'Há prazo interno ou externo?' },
  { id: 't3', dim: 'Timeline', label: 'O que acontece se não resolver até lá?' },
  { id: 't4', dim: 'Timeline', label: 'Já iniciou processo de compra?' },
  { id: 't5', dim: 'Timeline', label: 'Qual a próxima etapa no seu processo?' },
]

const DIM_COLORS: Record<string, string> = {
  Budget: 'text-success',
  Authority: 'text-primary',
  Need: 'text-warning-foreground',
  Timeline: 'text-accent',
}

function bantScore(answers: Record<string, string>): number {
  const filled = Object.values(answers).filter(v => v && v.trim().length >= 3).length
  return Math.round((filled / BANT_QUESTIONS.length) * 100)
}

// ── Aba: Resumo ───────────────────────────────────────────────
function TabResumo({ leadId }: { leadId: string }) {
  const { data: lead } = useLead(leadId)
  const updateLead = useUpdateLead()
  const [editing, setEditing] = useState<string | null>(null)
  const [val, setVal] = useState('')

  const { data: tags = [] } = useLeadTags()
  const assignTag = useAssignTag()
  const removeTag = useRemoveTag()

  if (!lead) return null

  const assignedTagIds = lead.lead_tag_assignments?.map(a => a.tag_id) ?? []

  const startEdit = (field: string, current: string) => {
    setEditing(field)
    setVal(current || '')
  }

  const saveEdit = async () => {
    if (!editing) return
    await updateLead.mutateAsync({ id: leadId, [editing]: val || null })
    setEditing(null)
  }

  const Field = ({ label, field, value, icon: Icon }: { label: string; field: string; value: string | null; icon?: React.ElementType }) => (
    <div className="group flex items-center gap-2 py-1.5 hover:bg-secondary/30 rounded-lg px-2 -mx-2 transition-colors">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
      {editing === field ? (
        <div className="flex items-center gap-1.5 flex-1">
          <Input className="h-6 text-xs" value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }} autoFocus />
          <button onClick={saveEdit}><Check className="h-3.5 w-3.5 text-success" /></button>
          <button onClick={() => setEditing(null)}><X className="h-3.5 w-3.5 text-destructive" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-foreground flex-1 truncate">{value || <span className="text-muted-foreground italic">—</span>}</span>
          <button onClick={() => startEdit(field, value ?? '')}
            className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Info pessoal */}
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dados pessoais</p>
        <Field label="Nome" field="name" value={lead.name} icon={User} />
        <Field label="Telefone" field="phone" value={lead.phone} icon={Phone} />
        <Field label="E-mail" field="email" value={lead.email} icon={Mail} />
        <Field label="Empresa" field="company" value={lead.company} icon={Building2} />
        <Field label="Cargo" field="job_title" value={lead.job_title} icon={User} />
      </div>

      {/* Score */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score geral</p>
          <div className="flex items-center gap-1.5">
            <Flame className={cn('h-4 w-4', lead.lead_score >= 70 ? 'text-success' : lead.lead_score >= 40 ? 'text-warning' : 'text-muted-foreground')} />
            <span className="text-xl font-bold text-foreground">{lead.lead_score}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${lead.lead_score}%`,
              backgroundColor: lead.lead_score >= 70 ? 'hsl(var(--success))' : lead.lead_score >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground))'
            }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>Frio</span><span>Morno</span><span>Quente</span>
        </div>
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</p>
        <div className="flex gap-1.5 flex-wrap">
          {lead.lead_tag_assignments?.map(a => (
            <button key={a.tag_id}
              onClick={() => removeTag.mutate({ leadId, tagId: a.tag_id })}
              className="flex items-center gap-1 text-xs rounded-md px-2 py-1 font-medium transition-opacity hover:opacity-70 group"
              style={{ backgroundColor: a.lead_tags.color + '20', color: a.lead_tags.color }}>
              {a.lead_tags.name}
              <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
            </button>
          ))}
          {tags.filter(t => !assignedTagIds.includes(t.id)).map(tag => (
            <button key={tag.id}
              onClick={() => assignTag.mutate({ leadId, tagId: tag.id })}
              className="text-xs rounded-md px-2 py-1 border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              + {tag.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Aba: BANT ─────────────────────────────────────────────────
function TabBANT({ leadId }: { leadId: string }) {
  const { data: lead } = useLead(leadId)
  const updateLead = useUpdateLead()
  const [answers, setAnswers] = useState<Record<string, string>>(
    (lead?.bant_answers as Record<string, string>) ?? {}
  )
  const [saving, setSaving] = useState(false)

  if (!lead) return null

  const score = bantScore(answers)
  const dims = ['Budget', 'Authority', 'Need', 'Timeline']

  const handleChange = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    await updateLead.mutateAsync({ id: leadId, bant_answers: answers as Record<string, unknown>, bant_score: score })
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Score BANT */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Score BANT</p>
          <span className="text-2xl font-bold text-primary">{score}<span className="text-sm text-muted-foreground">/100</span></span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${score}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {dims.map(dim => {
            const qs = BANT_QUESTIONS.filter(q => q.dim === dim)
            const filled = qs.filter(q => (answers[q.id] ?? '').trim().length >= 3).length
            return (
              <div key={dim} className="text-center">
                <p className={cn('text-xs font-semibold', DIM_COLORS[dim])}>{dim}</p>
                <p className="text-lg font-bold text-foreground">{Math.round((filled / qs.length) * 100)}%</p>
                <p className="text-[10px] text-muted-foreground">{filled}/{qs.length}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Perguntas por dimensão */}
      {dims.map(dim => (
        <div key={dim}>
          <p className={cn('text-xs font-semibold uppercase tracking-wider mb-2', DIM_COLORS[dim])}>{dim}</p>
          <div className="space-y-2">
            {BANT_QUESTIONS.filter(q => q.dim === dim).map(q => (
              <div key={q.id} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{q.label}</Label>
                <Input
                  className="h-8 text-sm"
                  value={answers[q.id] ?? ''}
                  onChange={e => handleChange(q.id, e.target.value)}
                  placeholder="Escreva a resposta..."
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button onClick={handleSave} loading={saving} className="w-full">Salvar BANT</Button>
    </div>
  )
}

// ── Aba: Notas ────────────────────────────────────────────────
function TabNotas({ leadId }: { leadId: string }) {
  const { data: notes = [] } = useLeadNotes(leadId)
  const createNote = useCreateNote()
  const deleteNote = useDeleteNote()
  const [content, setContent] = useState('')

  const handleCreate = async () => {
    if (!content.trim()) return
    await createNote.mutateAsync({ leadId, content })
    setContent('')
  }

  return (
    <div className="space-y-4">
      {/* Input nova nota */}
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Escreva uma nota sobre este lead..."
          className="w-full min-h-[80px] rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <Button size="sm" onClick={handleCreate} loading={createNote.isPending} disabled={!content.trim()}>
          <Plus className="h-3.5 w-3.5" /> Adicionar nota
        </Button>
      </div>

      {/* Lista de notas */}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota ainda.</p>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="group rounded-xl border border-border bg-card/50 p-3">
              <div className="flex items-start gap-2">
                {note.is_pinned && <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />}
                <p className="text-sm text-foreground flex-1 whitespace-pre-wrap">{note.content}</p>
                <button onClick={() => deleteNote.mutate({ id: note.id, leadId })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {note.profiles && (
                  <span className="text-[10px] text-muted-foreground">{note.profiles.full_name}</span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Aba: Origem / UTMs ────────────────────────────────────────
function TabOrigem({ leadId }: { leadId: string }) {
  const { data: lead } = useLead(leadId)
  if (!lead) return null

  const utmFields = [
    { label: 'UTM Source', value: lead.utm_source },
    { label: 'UTM Medium', value: lead.utm_medium },
    { label: 'UTM Campaign', value: lead.utm_campaign },
    { label: 'UTM Content', value: lead.utm_content },
    { label: 'UTM Term', value: lead.utm_term },
    { label: 'Referrer', value: lead.referrer },
    { label: 'Landing Page', value: lead.landing_page },
    { label: 'FBCLID', value: lead.fbclid },
    { label: 'GCLID', value: lead.gclid },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4 space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Origem do lead</p>
        </div>
        <div className="flex items-center gap-3 py-2 border-b border-border/50">
          <span className="text-xs text-muted-foreground w-28">Canal</span>
          <Badge variant="default" className="capitalize">{lead.source}</Badge>
        </div>
        {utmFields.map(({ label, value }) => value && (
          <div key={label} className="flex items-center gap-3 py-1.5">
            <span className="text-xs text-muted-foreground w-28">{label}</span>
            <span className="text-sm text-foreground truncate flex-1">{value}</span>
          </div>
        ))}
        {utmFields.every(f => !f.value) && lead.source === 'manual' && (
          <p className="text-xs text-muted-foreground py-2">Nenhum dado de rastreamento disponível.</p>
        )}
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Datas</p>
        <div className="space-y-2">
          {[
            { label: 'Criado em', value: lead.created_at },
            { label: 'Último contato', value: lead.last_contact_at },
            { label: 'Próximo follow-up', value: lead.next_follow_up_at },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-32">{label}</span>
              <span className="text-sm text-foreground">
                {value ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Aba: Carteira (Deals) ─────────────────────────────────────
function TabCarteira({ leadId }: { leadId: string }) {
  const { data: deals = [] } = useLeadDeals(leadId)
  const createDeal = useCreateDeal()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')

  const handleCreate = async () => {
    if (!title.trim() || !value) return
    await createDeal.mutateAsync({ lead_id: leadId, title, value: parseFloat(value) })
    setTitle(''); setValue(''); setCreating(false)
  }

  const statusIcons = { open: <Clock className="h-3.5 w-3.5 text-primary" />, won: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, lost: <XCircle className="h-3.5 w-3.5 text-destructive" />, cancelled: <X className="h-3.5 w-3.5 text-muted-foreground" /> }

  return (
    <div className="space-y-4">
      {/* Botão criar deal */}
      {!creating ? (
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" /> Novo negócio
        </Button>
      ) : (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Título *</Label>
            <Input className="h-8 text-sm" placeholder="Descrição do negócio" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor (R$) *</Label>
            <Input className="h-8 text-sm" type="number" placeholder="0,00" value={value} onChange={e => setValue(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} loading={createDeal.isPending}>Criar</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista de deals */}
      {deals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum negócio ainda.</p>
      ) : (
        <div className="space-y-2">
          {deals.map(deal => (
            <div key={deal.id} className="rounded-xl border border-border bg-card/50 p-3 flex items-start gap-3">
              {statusIcons[deal.status as keyof typeof statusIcons]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{deal.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs font-semibold text-primary">
                    R$ {deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  {deal.pipeline_stages && (
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: deal.pipeline_stages.color + '60', color: deal.pipeline_stages.color }}>
                      {deal.pipeline_stages.name}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground capitalize">{deal.status}</span>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(deal.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Aba: Timeline ─────────────────────────────────────────────
function TabTimeline({ leadId }: { leadId: string }) {
  const { data: interactions = [] } = useLeadTimeline(leadId)

  const typeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    note:         { icon: MessageSquare, label: 'Nota',          color: 'text-primary' },
    call:         { icon: Phone,         label: 'Ligação',        color: 'text-success' },
    email:        { icon: Mail,          label: 'E-mail',         color: 'text-accent' },
    whatsapp:     { icon: MessageSquare, label: 'WhatsApp',       color: 'text-success' },
    stage_change: { icon: ArrowRight,    label: 'Mudança estágio', color: 'text-warning-foreground' },
    deal:         { icon: DollarSign,    label: 'Negócio',        color: 'text-primary' },
    tag:          { icon: Tag,           label: 'Tag',            color: 'text-muted-foreground' },
    meeting:      { icon: Calendar,      label: 'Reunião',        color: 'text-accent' },
  }

  if (interactions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro na timeline.</p>
  }

  return (
    <div className="relative space-y-3">
      {/* Linha vertical */}
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border rounded" />

      {interactions.map((item, i) => {
        const cfg = typeConfig[item.type] ?? typeConfig.note
        const Icon = cfg.icon
        return (
          <div key={item.id} className="flex items-start gap-3 relative">
            <div className={cn('h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center flex-shrink-0 z-10', cfg.color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0 bg-card/50 rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {item.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.content}</p>}
              {item.profiles && <p className="text-[10px] text-muted-foreground mt-1">{item.profiles.full_name}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  LeadDetailModal — principal                             ║
// ╚══════════════════════════════════════════════════════════╝
export function LeadDetailModal({
  leadId, open, onClose,
}: {
  leadId: string
  open: boolean
  onClose: () => void
}) {
  const { data: lead } = useLead(leadId)
  const [activeTab, setActiveTab] = useState('resumo')

  const initials = lead?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
        {/* Header fixo */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={lead?.avatar_url ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">{lead?.name ?? '...'}</DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                {lead?.company && <span className="text-xs text-muted-foreground">{lead.company}</span>}
                {lead?.pipeline_stages && (
                  <Badge variant="outline" className="text-[10px]"
                    style={{ borderColor: lead.pipeline_stages.color + '60', color: lead.pipeline_stages.color }}>
                    {lead.pipeline_stages.name}
                  </Badge>
                )}
                {lead?.source && <Badge variant="muted" className="text-[10px] capitalize">{lead.source}</Badge>}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-border flex-shrink-0">
          <TabsList className="h-8">
            {[
              { value: 'resumo', label: 'Resumo' },
              { value: 'bant', label: 'BANT' },
              { value: 'notas', label: 'Notas' },
              { value: 'origem', label: 'Origem' },
              { value: 'carteira', label: 'Carteira' },
              { value: 'timeline', label: 'Timeline' },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="text-xs"
                onClick={() => setActiveTab(tab.value)}
                data-state={activeTab === tab.value ? 'active' : 'inactive'}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Content scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'resumo'   && <TabResumo   leadId={leadId} />}
          {activeTab === 'bant'     && <TabBANT     leadId={leadId} />}
          {activeTab === 'notas'    && <TabNotas    leadId={leadId} />}
          {activeTab === 'origem'   && <TabOrigem   leadId={leadId} />}
          {activeTab === 'carteira' && <TabCarteira leadId={leadId} />}
          {activeTab === 'timeline' && <TabTimeline leadId={leadId} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

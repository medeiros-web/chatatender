import { useState } from 'react'
import { Plus, Mail, Pencil, Trash2, Eye, Send, Copy, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  useEmailTemplates, useUpsertEmailTemplate, useDeleteEmailTemplate,
  useEmailSendLog, useMassCampaigns, useCreateCampaign,
  type EmailTemplate, type MassCampaign,
} from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const AVAILABLE_VARS = [
  'lead.name', 'lead.email', 'lead.phone', 'lead.source',
  'deal.value', 'deal.stage', 'agent.name', 'org.name',
  'user.name', 'user.email',
]

// ── Template dialog ───────────────────────────────────────────────────────────

type FormState = {
  id?: string
  name: string
  subject: string
  html_body: string
  variables: string[]
}

const EMPTY: FormState = { name: '', subject: '', html_body: '', variables: [] }

function TemplateDialog({
  initial,
  onClose,
}: {
  initial: FormState | null
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY)
  const [preview, setPreview] = useState(false)
  const upsert = useUpsertEmailTemplate()

  const insertVar = (v: string) => {
    const tag = `{{${v}}}`
    setForm(f => ({ ...f, html_body: f.html_body + tag }))
    if (!form.variables.includes(v)) {
      setForm(f => ({ ...f, variables: [...f.variables, v] }))
    }
  }

  const handleSave = () => {
    upsert.mutate(form as any, {
      onSuccess: onClose,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar template' : 'Novo template de e-mail'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome do template</label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Boas-vindas lead"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Assunto do e-mail</label>
              <Input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Ex: Olá {{lead.name}}, temos uma oferta!"
              />
            </div>
          </div>

          {/* Variable chips */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Inserir variável
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARS.map(v => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  className="text-xs rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors font-mono"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* HTML body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Corpo do e-mail (HTML)</label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setPreview(p => !p)}
              >
                <Eye className="h-3.5 w-3.5" />
                {preview ? 'Editar' : 'Preview'}
              </Button>
            </div>
            {preview ? (
              <div
                className="min-h-48 rounded-lg border border-border bg-white p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: form.html_body || '<p class="text-gray-400">Sem conteúdo</p>' }}
              />
            ) : (
              <Textarea
                value={form.html_body}
                onChange={e => setForm(f => ({ ...f, html_body: e.target.value }))}
                rows={12}
                placeholder="<p>Olá {{lead.name}},</p><p>...</p>"
                className="font-mono text-xs"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.subject || !form.html_body || upsert.isPending}>
            {upsert.isPending ? 'Salvando…' : 'Salvar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Campaign dialog ───────────────────────────────────────────────────────────

function CampaignDialog({ templates, onClose }: { templates: EmailTemplate[]; onClose: () => void }) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const create = useCreateCampaign()

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova campanha de e-mail</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome da campanha</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção junho" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Template</label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecionar template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => create.mutate({ name, template_id: templateId || undefined }, { onSuccess: onClose })}
            disabled={!name || create.isPending}
          >
            {create.isPending ? 'Criando…' : 'Criar campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Status badge helpers ──────────────────────────────────────────────────────

const LOG_STATUS: Record<string, { label: string; className: string }> = {
  queued:  { label: 'Na fila',  className: 'bg-muted text-muted-foreground' },
  sent:    { label: 'Enviado',  className: 'bg-emerald-500/15 text-emerald-600' },
  failed:  { label: 'Falhou',   className: 'bg-destructive/15 text-destructive' },
  bounced: { label: 'Bounce',   className: 'bg-orange-500/15 text-orange-600' },
}

const CAMP_STATUS: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Rascunho',   className: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Agendada',   className: 'bg-blue-500/15 text-blue-600' },
  sending:   { label: 'Enviando',   className: 'bg-yellow-500/15 text-yellow-700' },
  sent:      { label: 'Enviada',    className: 'bg-emerald-500/15 text-emerald-600' },
  cancelled: { label: 'Cancelada',  className: 'bg-destructive/15 text-destructive' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function EmailTemplatesPage() {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { data: sendLog = [] } = useEmailSendLog()
  const { data: campaigns = [] } = useMassCampaigns()
  const deleteTemplate = useDeleteEmailTemplate()

  const [editTemplate, setEditTemplate] = useState<FormState | null | false>(false)
  const [showCampaign, setShowCampaign] = useState(false)
  const [tab, setTab] = useState<'templates' | 'log' | 'campaigns'>('templates')

  const TABS = [
    { key: 'templates' as const, label: 'Templates' },
    { key: 'campaigns' as const, label: 'Campanhas' },
    { key: 'log'       as const, label: 'Log de envios' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-mail & Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie templates Resend e campanhas em massa
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCampaign(true)}>
            <Send className="h-4 w-4" />
            Nova campanha
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setEditTemplate(null)}>
            <Plus className="h-4 w-4" />
            Novo template
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)
          ) : templates.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum template criado ainda</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setEditTemplate(null)}>
                <Plus className="h-3.5 w-3.5" /> Criar primeiro template
              </Button>
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.subject}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditTemplate({
                        id: t.id, name: t.name, subject: t.subject,
                        html_body: t.html_body, variables: t.variables,
                      })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteTemplate.mutate(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.variables.slice(0, 4).map(v => (
                      <span key={v} className="text-[10px] font-mono rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {`{{${v}}}`}
                      </span>
                    ))}
                    {t.variables.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{t.variables.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {t.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(t.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Campaigns tab */}
      {tab === 'campaigns' && (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma campanha criada</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setShowCampaign(true)}>
                <Plus className="h-3.5 w-3.5" /> Nova campanha
              </Button>
            </div>
          ) : (
            campaigns.map(c => {
              const st = CAMP_STATUS[c.status] ?? { label: c.status, className: 'bg-muted text-muted-foreground' }
              const pct = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Template: {c.email_templates?.name ?? '—'}
                      </p>
                    </div>
                    <span className={cn('text-[11px] rounded-full px-2 py-0.5 font-medium', st.className)}>
                      {st.label}
                    </span>
                  </div>
                  {c.total_recipients > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.sent_count} de {c.total_recipients} enviados</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-muted-foreground">
                      Criada em {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    {c.failed_count > 0 && (
                      <span className="text-[11px] text-destructive">{c.failed_count} falharam</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Log tab */}
      {tab === 'log' && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Destinatário</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Assunto</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sendLog.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-sm text-muted-foreground">
                    Nenhum e-mail enviado ainda
                  </td>
                </tr>
              ) : (
                sendLog.map(log => {
                  const st = LOG_STATUS[log.status] ?? { label: log.status, className: 'bg-muted' }
                  return (
                    <tr key={log.id} className="hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{log.to_name ?? log.to_email}</p>
                        <p className="text-xs text-muted-foreground">{log.to_email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{log.subject}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-[11px] rounded-full px-2 py-0.5 font-medium', st.className)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialogs */}
      {editTemplate !== false && (
        <TemplateDialog
          initial={editTemplate}
          onClose={() => setEditTemplate(false)}
        />
      )}
      {showCampaign && (
        <CampaignDialog
          templates={templates}
          onClose={() => setShowCampaign(false)}
        />
      )}
    </div>
  )
}

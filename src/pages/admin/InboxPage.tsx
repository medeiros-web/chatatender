import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare, Phone, Mail, Search, X, Send, Paperclip,
  CheckCheck, Check, Clock, User, Building2, Tag, MoreVertical,
  ArrowRight, XCircle, StickyNote, RefreshCw,
  Bot, Users, Inbox
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  useConversations, useConversation, useMessages, useSendMessage,
  useAcceptConversation, useCloseConversation, useTransferConversation,
  useMarkAsRead, useConversationsRealtime, useMessagesRealtime,
  useConvNotes, useCreateConvNote,
  type Conversation, type Message, type ConvFilters,
} from '@/hooks/useConversations'
import { useSectors } from '@/hooks/useSectors'
import { useOrgMembers } from '@/hooks/useSectorMembers'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { useEvolutionInstances } from '@/hooks/useEvolution'

// ── Canal icon ───────────────────────────────────────────────
function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const map: Record<string, React.ElementType> = {
    webchat: MessageSquare, whatsapp: Phone,
    instagram: MessageSquare, facebook: MessageSquare,
    telegram: MessageSquare, email: Mail, sms: Phone,
  }
  const Icon = map[channel] ?? MessageSquare
  return <Icon className={className} />
}

const CHANNEL_COLORS: Record<string, string> = {
  webchat: 'text-primary', whatsapp: 'text-success',
  instagram: 'text-pink-500', facebook: 'text-blue-500',
  telegram: 'text-sky-500', email: 'text-accent', sms: 'text-muted-foreground',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open:          { label: 'Aberta',        color: 'bg-primary/20 text-primary' },
  waiting_human: { label: 'Aguard. humano', color: 'bg-warning/20 text-warning-foreground' },
  in_progress:   { label: 'Em andamento',  color: 'bg-success/20 text-success' },
  closed:        { label: 'Encerrada',     color: 'bg-muted text-muted-foreground' },
  spam:          { label: 'Spam',          color: 'bg-destructive/20 text-destructive' },
}

// ── Conversation List Item ────────────────────────────────────
function ConvItem({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  const initials = conv.contact_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  const status = STATUS_LABELS[conv.status] ?? STATUS_LABELS.open

  return (
    <button onClick={onClick} className={cn(
      'w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg transition-colors hover:bg-secondary/50',
      active && 'bg-secondary border border-border/50'
    )}>
      <div className="relative flex-shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarImage src={conv.contact_avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className={cn('absolute -bottom-0.5 -right-0.5 rounded-full p-0.5 bg-card', CHANNEL_COLORS[conv.channel])}>
          <ChannelIcon channel={conv.channel} className="h-2.5 w-2.5" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 justify-between">
          <p className="text-sm font-medium text-foreground truncate">
            {conv.contact_name ?? conv.contact_phone ?? conv.contact_email ?? 'Contato'}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {conv.unread_count > 0 && (
              <span className="text-[10px] bg-primary text-white rounded-full px-1.5 py-0.5 font-bold">
                {conv.unread_count}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {conv.last_message_at
                ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : ''}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {conv.last_message_preview ?? 'Sem mensagens'}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={cn('text-[10px] rounded px-1.5 py-0.5 font-medium', status.color)}>{status.label}</span>
          {conv.sectors && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: conv.sectors.color }} />
              {conv.sectors.name}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Message Bubble ────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isOut = !msg.is_from_contact
  const isSystem = msg.message_type === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-3 py-1">
          {msg.content}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2 mb-3', isOut ? 'justify-end' : 'justify-start')}>
      {!isOut && (
        <Avatar className="h-6 w-6 mt-auto flex-shrink-0">
          <AvatarFallback className="text-[10px]">?</AvatarFallback>
        </Avatar>
      )}
      <div className={cn(
        'max-w-[70%] rounded-2xl px-3 py-2 text-sm',
        isOut
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-card border border-border text-foreground rounded-bl-sm'
      )}>
        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
        {msg.media_url && (
          <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
            className="text-xs underline opacity-80">
            {msg.media_filename ?? '📎 Anexo'}
          </a>
        )}
        <div className={cn('flex items-center gap-1 mt-1', isOut ? 'justify-end' : 'justify-start')}>
          <span className={cn('text-[10px]', isOut ? 'text-white/70' : 'text-muted-foreground')}>
            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOut && (
            msg.is_read ? <CheckCheck className="h-3 w-3 text-white/70" />
            : msg.is_delivered ? <CheckCheck className="h-3 w-3 text-white/50" />
            : msg.is_sent ? <Check className="h-3 w-3 text-white/50" />
            : <Clock className="h-3 w-3 text-white/50" />
          )}
        </div>
      </div>
      {isOut && (
        <Avatar className="h-6 w-6 mt-auto flex-shrink-0">
          <AvatarImage src={msg.profiles?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">{msg.profiles?.full_name?.[0] ?? 'A'}</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// ── Accept Dialog ─────────────────────────────────────────────
function AcceptDialog({ conv, open, onClose }: { conv: Conversation; open: boolean; onClose: () => void }) {
  const accept = useAcceptConversation()
  const { data: sectors = [] } = useSectors()
  const { user } = useAuth()
  const [sectorId, setSectorId] = useState(conv.sector_id ?? '')

  const userSectors = sectors.filter(s => s.is_active)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aceitar atendimento</DialogTitle>
          <DialogDescription>Selecione o setor para este atendimento.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>Setor *</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
              <SelectContent>
                {userSectors.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!sectorId}
            loading={accept.isPending}
            onClick={async () => {
              await accept.mutateAsync({ convId: conv.id, sectorId })
              onClose()
            }}>
            Aceitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Transfer Dialog ───────────────────────────────────────────
function TransferDialog({ convId, open, onClose }: { convId: string; open: boolean; onClose: () => void }) {
  const transfer = useTransferConversation()
  const { data: sectors = [] } = useSectors()
  const { data: members = [] } = useOrgMembers()
  const [toUserId, setToUserId] = useState('')
  const [toSectorId, setToSectorId] = useState('')
  const [reason, setReason] = useState('')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
          <DialogDescription>Transfira para um agente específico ou para um setor.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>Para agente</Label>
            <Select value={toUserId} onValueChange={v => { setToUserId(v); if (v) setToSectorId('') }}>
              <SelectTrigger><SelectValue placeholder="Selecionar agente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name ?? m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Separator className="flex-1" /><span className="text-xs text-muted-foreground">ou</span><Separator className="flex-1" />
          </div>
          <div className="space-y-1.5">
            <Label>Para setor</Label>
            <Select value={toSectorId} onValueChange={v => { setToSectorId(v); if (v) setToUserId('') }}>
              <SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {sectors.filter(s => s.is_active).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input placeholder="Ex: Especialidade técnica" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            loading={transfer.isPending}
            disabled={!toUserId && !toSectorId}
            onClick={async () => {
              await transfer.mutateAsync({ convId, toUserId: toUserId || undefined, toSectorId: toSectorId || undefined, reason: reason || undefined })
              onClose()
            }}>
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Chat Panel ────────────────────────────────────────────────
function ChatPanel({ convId, onClose }: { convId: string; onClose?: () => void }) {
  const { user } = useAuth()
  const { data: conv } = useConversation(convId)
  const { data: messages = [], refetch: refetchMsgs } = useMessages(convId)
  const { data: notes = [] } = useConvNotes(convId)
  const sendMsg = useSendMessage()
  const closeConv = useCloseConversation()
  const markRead = useMarkAsRead()
  const createNote = useCreateConvNote()

  const [text, setText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Realtime messages
  const onNewMessage = useCallback(() => refetchMsgs(), [refetchMsgs])
  useMessagesRealtime(convId, onNewMessage)

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read on open
  useEffect(() => {
    if (convId && conv?.unread_count && conv.unread_count > 0) {
      markRead.mutate(convId)
    }
  }, [convId, conv?.unread_count])

  const handleSend = async () => {
    if (!text.trim()) return
    await sendMsg.mutateAsync({ conversationId: convId, content: text.trim() })
    setText('')
  }

  const isAssignedToMe = conv?.assigned_user_id === user?.id
  const isClosed = conv?.status === 'closed'
  const canSend = isAssignedToMe && !isClosed
  const status = STATUS_LABELS[conv?.status ?? 'open']

  if (!conv) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Carregando conversa...
    </div>
  )

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header da conversa */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={conv.contact_avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {conv.contact_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-foreground truncate">
              {conv.contact_name ?? conv.contact_phone ?? 'Contato'}
            </p>
            <span className={cn('text-[10px] rounded px-1.5 py-0.5 font-medium', status.color)}>{status.label}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ChannelIcon channel={conv.channel} className={cn('h-3 w-3', CHANNEL_COLORS[conv.channel])} />
            {conv.protocol && <span>{conv.protocol}</span>}
            {conv.sectors && <span>· {conv.sectors.name}</span>}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5">
          {!isClosed && !isAssignedToMe && (
            <Button size="sm" variant="outline" onClick={() => setAcceptOpen(true)}>
              <User className="h-3.5 w-3.5" /> Aceitar
            </Button>
          )}
          {!isClosed && isAssignedToMe && (
            <>
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                <ArrowRight className="h-3.5 w-3.5" /> Transferir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNotes(v => !v)}>
                <StickyNote className={cn('h-3.5 w-3.5', showNotes && 'text-primary')} />
                {notes.length > 0 && <Badge variant="muted" className="ml-1 text-[10px] h-4 px-1">{notes.length}</Badge>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCloseConfirm(true)} className="text-destructive hover:text-destructive">
                <XCircle className="h-3.5 w-3.5" /> Encerrar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="border-b border-border bg-warning/5 px-4 py-3 flex-shrink-0">
          <p className="text-xs font-semibold text-warning-foreground mb-2">Notas internas</p>
          <div className="space-y-2 max-h-32 overflow-y-auto mb-2">
            {notes.length === 0 && <p className="text-xs text-muted-foreground">Sem notas.</p>}
            {notes.map(n => (
              <div key={n.id} className="text-xs text-foreground bg-card rounded-lg px-3 py-2 border border-border/50">
                <p>{n.content}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{n.profiles?.full_name} · {new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input className="h-7 text-xs" placeholder="Adicionar nota interna..." value={noteText} onChange={e => setNoteText(e.target.value)} />
            <Button size="sm" className="h-7 text-xs px-2"
              loading={createNote.isPending}
              onClick={async () => { if (noteText.trim()) { await createNote.mutateAsync({ convId, content: noteText.trim() }); setNoteText('') } }}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="border-t border-border px-4 py-3 flex-shrink-0 bg-card/30">
          {!canSend && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              {conv.status === 'open' || conv.status === 'waiting_human'
                ? <><Bot className="h-3.5 w-3.5 text-accent" /> IA respondendo. Aceite o ticket para assumir o atendimento.</>
                : <><Users className="h-3.5 w-3.5" /> Atribuído a outro agente.</>
              }
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon-sm" disabled={!canSend}>
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            </Button>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={!canSend}
              placeholder={canSend ? 'Digite uma mensagem...' : 'Aceite o ticket para responder'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              className="flex-1 min-h-[36px] max-h-32 resize-none rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button size="icon-sm" onClick={handleSend} disabled={!canSend || !text.trim()} loading={sendMsg.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isClosed && (
        <div className="border-t border-border px-4 py-3 text-center bg-muted/20 flex-shrink-0">
          <p className="text-xs text-muted-foreground">Esta conversa foi encerrada.</p>
        </div>
      )}

      {/* Dialogs */}
      {acceptOpen && <AcceptDialog conv={conv} open={acceptOpen} onClose={() => setAcceptOpen(false)} />}
      {transferOpen && <TransferDialog convId={convId} open={transferOpen} onClose={() => setTransferOpen(false)} />}

      <Dialog open={closeConfirm} onOpenChange={v => !v && setCloseConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Encerrar conversa?</DialogTitle>
            <DialogDescription>O cliente receberá uma mensagem informando que o atendimento foi encerrado.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" loading={closeConv.isPending}
              onClick={async () => { await closeConv.mutateAsync({ convId }); setCloseConfirm(false) }}>
              Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  InboxPage                                               ║
// ╚══════════════════════════════════════════════════════════╝
export function InboxPage() {
  const { organizationId, user } = useAuth()
  const qc = useQueryClient()
  const [filters, setFilters] = useState<ConvFilters>({ status: 'open' })
  const [search, setSearch] = useState('')
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [filterInstance, setFilterInstance] = useState<string>('')

  const { data: waInstances = [] } = useEvolutionInstances()

  const effectiveFilters: ConvFilters = { ...filters, search: search || undefined }
  const { data: allConversations = [], isLoading, refetch } = useConversations(effectiveFilters)
  const { data: sectors = [] } = useSectors()

  // Filtra por instância WhatsApp se selecionada
  const conversations = filterInstance
    ? allConversations.filter(c => (c as unknown as Record<string, unknown>).whatsapp_instance_id === filterInstance)
    : allConversations

  // Realtime invalidation
  const onConvUpdate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['conversations', organizationId] })
  }, [qc, organizationId])

  useConversationsRealtime(organizationId, onConvUpdate)

  const statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'open', label: 'Abertas' },
    { value: 'waiting_human', label: 'Aguard. humano' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'closed', label: 'Encerradas' },
  ]

  const myConvs = conversations.filter(c => c.assigned_user_id === user?.id)
  const totalUnread = conversations.reduce((acc, c) => acc + c.unread_count, 0)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: lista de conversas */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-card/30">
        {/* Header */}
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Inbox</h2>
            {totalUnread > 0 && (
              <Badge variant="default" className="ml-auto text-[10px] h-4 px-1">{totalUnread}</Badge>
            )}
            <Button variant="ghost" size="icon-sm" onClick={() => refetch()} title="Atualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Busca */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-7 text-xs" placeholder="Buscar conversa..." value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-3 w-3" /></button>}
          </div>

          {/* Filtro por instância WhatsApp */}
          {waInstances.length > 0 && (
            <Select value={filterInstance} onValueChange={setFilterInstance}>
              <SelectTrigger className="h-7 text-xs mb-2">
                <Phone className="h-3 w-3 text-success mr-1.5" />
                <SelectValue placeholder="Todas as instâncias WA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as instâncias</SelectItem>
                {waInstances.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn('h-1.5 w-1.5 rounded-full', i.status === 'connected' ? 'bg-success' : 'bg-muted-foreground')} />
                      {i.display_name ?? i.instance_name}
                      <span className="text-[10px] text-muted-foreground">({i.provider === 'evolution_go' ? 'GO' : 'API'})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Filtros de status */}
          <div className="flex gap-1 flex-wrap">
            {statusOptions.map(opt => (
              <button key={opt.value}
                onClick={() => setFilters(f => ({ ...f, status: opt.value as ConvFilters['status'] }))}
                className={cn(
                  'text-[10px] rounded-full px-2 py-0.5 border transition-colors',
                  filters.status === opt.value
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                )}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-filtros */}
        <div className="flex gap-2 px-3 py-2 border-b border-border">
          <button
            onClick={() => setFilters(f => ({ ...f, assignedTo: f.assignedTo ? undefined : user?.id }))}
            className={cn('flex items-center gap-1 text-[10px] rounded-md px-2 py-1 border transition-colors',
              filters.assignedTo ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-muted-foreground hover:border-primary hover:text-primary')}>
            <User className="h-3 w-3" /> Minhas
          </button>
          <button
            onClick={() => setFilters(f => ({ ...f, unassigned: !f.unassigned }))}
            className={cn('flex items-center gap-1 text-[10px] rounded-md px-2 py-1 border transition-colors',
              filters.unassigned ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-muted-foreground hover:border-primary hover:text-primary')}>
            <Bot className="h-3 w-3" /> Sem atribuição
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            conversations.map(conv => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={selectedConvId === conv.id}
                onClick={() => setSelectedConvId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedConvId ? (
          <ChatPanel convId={selectedConvId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Selecione uma conversa</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Escolha uma conversa na lista à esquerda para iniciar o atendimento.
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Realtime ativo
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

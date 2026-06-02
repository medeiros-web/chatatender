import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronRight, Bot, Calendar, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useFunnelBySlug, trackFunnelEvent, type FunnelBlock } from '@/hooks/useFunnels'

// ── UTM helpers ───────────────────────────────────────────────
function getUTMs(): Record<string, string> {
  const sp = new URLSearchParams(window.location.search)
  return {
    utm_source:   sp.get('utm_source')   ?? '',
    utm_medium:   sp.get('utm_medium')   ?? '',
    utm_campaign: sp.get('utm_campaign') ?? '',
    utm_content:  sp.get('utm_content')  ?? '',
    utm_term:     sp.get('utm_term')     ?? '',
    fbclid:       sp.get('fbclid')       ?? '',
    gclid:        sp.get('gclid')        ?? '',
  }
}

function getSessionId() {
  let sid = sessionStorage.getItem('funnel_sid')
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem('funnel_sid', sid) }
  return sid
}

// ── Block renderers ───────────────────────────────────────────
function QuestionBlock({
  block, onAnswer,
}: {
  block: FunnelBlock
  onAnswer: (value: string, nextId?: string) => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{block.title}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <div className="space-y-2">
        {(block.options ?? []).map(opt => (
          <button key={opt.value}
            onClick={() => onAnswer(opt.label, opt.next_block_id)}
            className="w-full flex items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3 text-left
              hover:border-primary hover:bg-primary/5 transition-all duration-150 group">
            <span className="h-6 w-6 rounded-full border-2 border-border flex items-center justify-center flex-shrink-0
              group-hover:border-primary group-hover:bg-primary/10 transition-colors">
              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
            </span>
            <span className="text-sm font-medium text-foreground">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function StatementBlock({ block, onNext }: { block: FunnelBlock; onNext: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl font-bold text-foreground">{block.title}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <Button onClick={onNext} className="px-8">
        Continuar <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

function CaptureBlock({ block, onSubmit }: { block: FunnelBlock; onSubmit: (data: Record<string, string>) => void }) {
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    await onSubmit({ name, email, phone })
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{block.title}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <div className="space-y-3">
        <Input placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} />
        <Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
        <Input type="tel" placeholder="Seu WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} />
      </div>
      <Button className="w-full" loading={loading} onClick={handleSubmit}
        disabled={!name || (!email && !phone)}>
        Quero minha vaga <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

function ScheduleBlock({ block, onNext }: { block: FunnelBlock; onNext: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Calendar className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{block.title}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <Button onClick={onNext} className="w-full">
        Escolher horário <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

function AITakeoverBlock({ block }: { block: FunnelBlock }) {
  return (
    <div className="space-y-4 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto animate-pulse">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{block.title || 'Um especialista vai te atender'}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <p className="text-xs text-muted-foreground">Aguarde, conectando...</p>
    </div>
  )
}

function RedirectBlock({ block }: { block: FunnelBlock }) {
  useEffect(() => {
    const url = block.settings?.url as string
    if (url) setTimeout(() => window.location.href = url, 1500)
  }, [block])
  return (
    <div className="text-center space-y-3">
      <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
      <p className="text-sm text-muted-foreground">Redirecionando...</p>
    </div>
  )
}

function CompleteScreen() {
  return (
    <div className="text-center space-y-4">
      <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Pronto!</h2>
      <p className="text-muted-foreground text-sm">Suas respostas foram registradas. Em breve entraremos em contato.</p>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════╗
// ║  PublicFunnelPage                                        ║
// ╚══════════════════════════════════════════════════════════╝
export function PublicFunnelPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: funnel, isLoading } = useFunnelBySlug(slug)

  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [completed, setCompleted] = useState(false)
  const sessionId = useRef(getSessionId())
  const utms = useRef(getUTMs())
  const tracked = useRef(false)

  useEffect(() => {
    if (!funnel || tracked.current) return
    tracked.current = true
    setCurrentBlockId(funnel.start_block_id ?? funnel.blocks[0]?.id ?? null)
    trackFunnelEvent({
      funnelId: funnel.id,
      organizationId: funnel.organization_id,
      sessionId: sessionId.current,
      eventType: 'view',
      utms: utms.current,
    })
  }, [funnel])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Funil não encontrado</h1>
          <p className="text-muted-foreground text-sm">Este link pode ter expirado ou estar incorreto.</p>
        </div>
      </div>
    )
  }

  const currentBlock = funnel.blocks.find(b => b.id === currentBlockId) ?? null
  const blockIndex = funnel.blocks.findIndex(b => b.id === currentBlockId)
  const progress = funnel.blocks.length > 0
    ? Math.round(((blockIndex + 1) / funnel.blocks.length) * 100)
    : 0

  const goToNext = (nextId?: string) => {
    const next = nextId ?? funnel.blocks[blockIndex + 1]?.id
    if (next) {
      setCurrentBlockId(next)
    } else {
      setCompleted(true)
      trackFunnelEvent({
        funnelId: funnel.id,
        organizationId: funnel.organization_id,
        sessionId: sessionId.current,
        eventType: 'complete',
        utms: utms.current,
      })
    }
  }

  const handleAnswer = (blockId: string, value: string, nextId?: string) => {
    setAnswers(prev => ({ ...prev, [blockId]: value }))
    trackFunnelEvent({
      funnelId: funnel.id,
      organizationId: funnel.organization_id,
      sessionId: sessionId.current,
      eventType: 'answer',
      blockId,
      answerValue: value,
      utms: utms.current,
    })
    goToNext(nextId)
  }

  const handleCapture = async (data: Record<string, string>) => {
    // Registra lead no Supabase via form submission
    try {
      const resp = await fetch('/api/funnel-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnel_id: funnel.id,
          organization_id: funnel.organization_id,
          ...data,
          ...utms.current,
        }),
      })
      if (!resp.ok) console.warn('Capture failed', await resp.text())
    } catch (e) {
      console.warn('Capture error', e)
    }
    goToNext()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      {!completed && funnel.blocks.length > 1 && (
        <div className="h-1 bg-muted w-full">
          <div className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          {completed ? (
            <CompleteScreen />
          ) : !currentBlock ? (
            <p className="text-center text-muted-foreground">Funil sem blocos configurados.</p>
          ) : (
            <div className={cn(
              'transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
            )}>
              {currentBlock.type === 'question' && (
                <QuestionBlock
                  block={currentBlock}
                  onAnswer={(val, nextId) => handleAnswer(currentBlock.id, val, nextId)}
                />
              )}
              {currentBlock.type === 'statement' && (
                <StatementBlock block={currentBlock} onNext={() => goToNext()} />
              )}
              {currentBlock.type === 'capture' && (
                <CaptureBlock block={currentBlock} onSubmit={handleCapture} />
              )}
              {currentBlock.type === 'schedule' && (
                <ScheduleBlock block={currentBlock} onNext={() => goToNext()} />
              )}
              {currentBlock.type === 'ai_takeover' && (
                <AITakeoverBlock block={currentBlock} />
              )}
              {currentBlock.type === 'redirect' && (
                <RedirectBlock block={currentBlock} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground/50">Powered by ChatAtender</p>
      </div>
    </div>
  )
}

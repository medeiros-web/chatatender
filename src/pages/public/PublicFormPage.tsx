import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CheckCircle2, Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useFormBySlug, submitForm, type FormBlock } from '@/hooks/useForms'

// ── UTMs ──────────────────────────────────────────────────────
function getUTMs() {
  const sp = new URLSearchParams(window.location.search)
  return {
    utm_source:   sp.get('utm_source')   ?? '',
    utm_medium:   sp.get('utm_medium')   ?? '',
    utm_campaign: sp.get('utm_campaign') ?? '',
    utm_content:  sp.get('utm_content')  ?? '',
    utm_term:     sp.get('utm_term')     ?? '',
  }
}

function getSessionId() {
  let sid = sessionStorage.getItem('form_sid')
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem('form_sid', sid) }
  return sid
}

// ── Block renderers ───────────────────────────────────────────
function ShortTextInput({ block, value, onChange }: { block: FormBlock; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold text-foreground leading-tight">{block.label}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <Input
        placeholder={block.placeholder ?? 'Sua resposta...'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-base h-12 border-0 border-b-2 border-border rounded-none bg-transparent focus:ring-0 focus:border-primary px-0"
        autoFocus
      />
    </div>
  )
}

function LongTextInput({ block, value, onChange }: { block: FormBlock; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold text-foreground leading-tight">{block.label}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <textarea
        className="w-full min-h-[120px] bg-transparent border-0 border-b-2 border-border rounded-none text-base text-foreground
          placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none px-0 py-2"
        placeholder={block.placeholder ?? 'Sua resposta...'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus
      />
    </div>
  )
}

function SelectInput({ block, value, onChange, multi = false }: { block: FormBlock; value: string; onChange: (v: string) => void; multi?: boolean }) {
  const selected = multi ? value.split(',').filter(Boolean) : [value].filter(Boolean)

  const toggle = (val: string) => {
    if (!multi) { onChange(val); return }
    const next = selected.includes(val)
      ? selected.filter(s => s !== val)
      : [...selected, val]
    onChange(next.join(','))
  }

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold text-foreground leading-tight">{block.label}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <div className="space-y-2">
        {(block.options ?? []).map(opt => {
          const isSelected = selected.includes(opt.value)
          return (
            <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all',
                isSelected ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40 text-foreground'
              )}>
              <div className={cn(
                'h-5 w-5 rounded flex items-center justify-center border-2 flex-shrink-0',
                isSelected ? 'border-primary bg-primary' : 'border-border'
              )}>
                {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
              </div>
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RatingInput({ block, value, onChange }: { block: FormBlock; value: string; onChange: (v: string) => void }) {
  const max = (block.settings?.max_rating as number) ?? 5
  const current = parseInt(value) || 0

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-foreground leading-tight">{block.label}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" onClick={() => onChange(String(n))}
            className="transition-transform hover:scale-110">
            <Star className={cn('h-8 w-8', n <= current ? 'fill-warning text-warning' : 'text-muted-foreground')} />
          </button>
        ))}
      </div>
      {current > 0 && (
        <p className="text-sm text-muted-foreground">{current} de {max} estrelas</p>
      )}
    </div>
  )
}

function DateInput({ block, value, onChange }: { block: FormBlock; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold text-foreground leading-tight">{block.label}</h2>
      {block.description && <p className="text-sm text-muted-foreground">{block.description}</p>}
      <Input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-base h-12 border-0 border-b-2 border-border rounded-none bg-transparent focus:ring-0 focus:border-primary px-0"
        autoFocus
      />
    </div>
  )
}

function StatementDisplay({ block }: { block: FormBlock }) {
  return (
    <div className="text-center space-y-4">
      <h2 className="text-3xl font-bold text-foreground leading-tight">{block.label}</h2>
      {block.description && <p className="text-muted-foreground">{block.description}</p>}
    </div>
  )
}

function BlockRenderer({
  block, value, onChange,
}: {
  block: FormBlock
  value: string
  onChange: (v: string) => void
}) {
  switch (block.block_type) {
    case 'short_text': case 'email': case 'phone':
      return <ShortTextInput block={block} value={value} onChange={onChange} />
    case 'long_text':
      return <LongTextInput block={block} value={value} onChange={onChange} />
    case 'select':
      return <SelectInput block={block} value={value} onChange={onChange} />
    case 'multiselect':
      return <SelectInput block={block} value={value} onChange={onChange} multi />
    case 'rating':
      return <RatingInput block={block} value={value} onChange={onChange} />
    case 'date':
      return <DateInput block={block} value={value} onChange={onChange} />
    case 'statement':
      return <StatementDisplay block={block} />
    default:
      return <ShortTextInput block={block} value={value} onChange={onChange} />
  }
}

// ╔══════════════════════════════════════════════════════════╗
// ║  PublicFormPage                                          ║
// ╚══════════════════════════════════════════════════════════╝
export function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading } = useFormBySlug(slug)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const sessionId = useRef(getSessionId())
  const utms = useRef(getUTMs())

  const form   = data?.form
  const blocks = data?.blocks ?? []

  const currentBlock = blocks[currentIndex]
  const progress = blocks.length > 0 ? Math.round(((currentIndex + 1) / blocks.length) * 100) : 0

  const currentValue = currentBlock ? (answers[currentBlock.id] ?? '') : ''

  const canAdvance = !currentBlock?.required || currentValue.length > 0 || currentBlock.block_type === 'statement'

  const handleNext = async () => {
    if (currentIndex < blocks.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      // Submit
      if (!form) return
      setSubmitting(true)
      try {
        await submitForm({
          formId: form.id,
          organizationId: form.organization_id,
          answers: answers as Record<string, unknown>,
          utms: utms.current,
          sessionId: sessionId.current,
        })
        setCompleted(true)
        if (form.settings?.redirect_url) {
          setTimeout(() => { window.location.href = form.settings.redirect_url as string }, 2000)
        }
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canAdvance) handleNext()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!form || blocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Formulário não encontrado</h1>
          <p className="text-sm text-muted-foreground">Este formulário pode ter sido desativado.</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {form.settings?.submit_message ?? 'Obrigado pelo envio!'}
          </h2>
          {form.settings?.redirect_url && (
            <p className="text-sm text-muted-foreground">Redirecionando...</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" onKeyDown={handleKeyDown}>
      {/* Progress */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-10">
        <div className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 pt-12">
        <div className="w-full max-w-lg space-y-8">
          {/* Block */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <BlockRenderer
              block={currentBlock}
              value={currentValue}
              onChange={v => setAnswers(prev => ({ ...prev, [currentBlock.id]: v }))}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm"
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="text-muted-foreground">
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex flex-col items-center gap-1">
              <Button
                onClick={handleNext}
                disabled={!canAdvance}
                loading={submitting}
                className="px-6 gap-2">
                {currentIndex === blocks.length - 1 ? 'Enviar' : 'Próximo'}
                {currentIndex < blocks.length - 1 && <ChevronRight className="h-4 w-4" />}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                pressione <kbd className="font-mono">Enter ↵</kbd>
              </p>
            </div>

            <div className="w-16 text-right">
              <span className="text-xs text-muted-foreground">{currentIndex + 1}/{blocks.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground/40">Powered by ChatAtender</p>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, Loader2, ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'Como conectar o WhatsApp?',
  'Como criar um agente de IA?',
  'Como funciona o pipeline de leads?',
  'Como integrar Google Calendar?',
]

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <p key={i} className="font-semibold text-foreground mt-2">{line.slice(3)}</p>
        }
        if (line.startsWith('### ')) {
          return <p key={i} className="font-medium text-foreground mt-1.5">{line.slice(4)}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <p key={i} className="flex gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              <span>{line.slice(2)}</span>
            </p>
          )
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>
        }
        if (!line.trim()) return <div key={i} className="h-1" />
        // inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )
      })}
    </div>
  )
}

export function HelpChatBot() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: next }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido')

      const assistantMsg: Message = { role: 'assistant', content: data.response }
      setMessages(prev => [...prev, assistantMsg])
      if (!open) setUnread(u => u + 1)
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Desculpe, ocorreu um erro: ${String(err)}. Tente novamente em instantes.`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    setMinimized(false)
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Olá! 👋 Sou o assistente do ChatAtender. Posso te ajudar a entender qualquer funcionalidade do sistema.\n\nO que você gostaria de saber?',
      }])
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          className={cn(
            'fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl',
            'bg-gradient-to-br from-primary to-accent text-white',
            'hover:scale-105 active:scale-95 transition-all duration-200',
            'ring-4 ring-primary/20'
          )}
          title="Ajuda — Assistente ChatAtender"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-xs font-bold">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className={cn(
            'fixed bottom-6 left-6 z-50 flex flex-col rounded-2xl shadow-2xl border border-border bg-card',
            'w-[360px] transition-all duration-300 overflow-hidden',
            minimized ? 'h-14' : 'h-[520px]'
          )}
        >
          {/* Header */}
          <div className="flex h-14 flex-shrink-0 items-center gap-3 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-t-2xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">Assistente ChatAtender</p>
              <p className="text-xs text-white/70 mt-0.5">Tira dúvidas sobre o sistema</p>
            </div>
            <button
              onClick={() => setMinimized(v => !v)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', minimized && 'rotate-180')} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-2 max-w-[90%]',
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2.5',
                        msg.role === 'user'
                          ? 'bg-primary text-white rounded-tr-sm text-sm'
                          : 'bg-muted text-foreground rounded-tl-sm'
                      )}
                    >
                      {msg.role === 'assistant'
                        ? <MarkdownText text={msg.content} />
                        : <p className="text-sm">{msg.content}</p>
                      }
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 max-w-[90%] mr-auto">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Pensando...</span>
                    </div>
                  </div>
                )}

                {/* Suggested questions */}
                {isEmpty && !loading && (
                  <div className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium px-1">Perguntas frequentes:</p>
                    {SUGGESTED.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="w-full text-left text-xs rounded-xl border border-border px-3 py-2 hover:bg-muted hover:border-primary/30 transition-colors text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex-shrink-0 border-t border-border p-3 flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Pergunte sobre o sistema..."
                  disabled={loading}
                  className={cn(
                    'flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm',
                    'outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                    'placeholder:text-muted-foreground disabled:opacity-50'
                  )}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
                    'bg-primary text-white transition-all',
                    'hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed',
                    'active:scale-95'
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

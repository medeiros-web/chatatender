import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface Props {
  hasUpdate: boolean
  onApply: () => void
}

export function UpdatePrompt({ hasUpdate, onApply }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (!hasUpdate || dismissed) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99] w-[calc(100%-2rem)] max-w-sm"
      role="alert"
    >
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card shadow-xl px-4 py-3 backdrop-blur-md">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <RefreshCw className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Nova versão disponível</p>
          <p className="text-xs text-muted-foreground">Atualize para obter as últimas melhorias.</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" onClick={onApply}>
            Atualizar
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePWAContext } from '@/components/pwa/PWAProvider'
import { haptic } from '@/hooks/usePWA'

export function InstallBanner() {
  const { canInstall, install, isInstalled } = usePWAContext()
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('pwa-install-dismissed') === '1' } catch { return false }
  })

  if (!canInstall || isInstalled || dismissed) return null

  const handleInstall = async () => {
    haptic('medium')
    const accepted = await install()
    if (!accepted) {
      setDismissed(true)
      localStorage.setItem('pwa-install-dismissed', '1')
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mx-4 mt-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
        <Download className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Instalar ChatAtender</p>
        <p className="text-xs text-muted-foreground">Acesso rápido direto da tela inicial</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button size="sm" onClick={handleInstall}>Instalar</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

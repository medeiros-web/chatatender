import { useState } from 'react'
import { usePWA } from '@/hooks/usePWA'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InstallBanner() {
  const { canInstall, install, isInstalled } = usePWA()
  const [dismissed, setDismissed] = useState(false)

  if (!canInstall || isInstalled || dismissed) return null

  const handleInstall = async () => {
    const accepted = await install()
    if (!accepted) setDismissed(true)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mx-4 mt-4">
      <Download className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Instalar ChatAtender</p>
        <p className="text-xs text-muted-foreground">Acesso rápido direto da tela inicial</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button size="sm" onClick={handleInstall}>Instalar</Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

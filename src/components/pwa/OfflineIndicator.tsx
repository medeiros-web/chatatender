import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  isOnline: boolean
}

export function OfflineIndicator({ isOnline }: Props) {
  return (
    <div
      className={cn(
        'fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2',
        'bg-destructive text-destructive-foreground text-xs font-medium py-1.5 px-4',
        'transition-transform duration-300 ease-in-out',
        isOnline ? '-translate-y-full' : 'translate-y-0'
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      <span>Sem conexão — exibindo dados em cache</span>
    </div>
  )
}

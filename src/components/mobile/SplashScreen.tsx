import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { MessageSquare } from 'lucide-react'
import { usePlatformName } from '@/hooks/usePlatformBranding'

interface Props {
  onDone?: () => void
  minDuration?: number
}

export function SplashScreen({ onDone, minDuration = 1800 }: Props) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)
  const platformName = usePlatformName()

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true)
      setTimeout(() => {
        setVisible(false)
        onDone?.()
      }, 400)
    }, minDuration)
    return () => clearTimeout(timer)
  }, [minDuration, onDone])

  if (!visible) return null

  return (
    <div className={cn(
      'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-400',
      fading ? 'opacity-0' : 'opacity-100'
    )}>
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent shadow-2xl">
          <MessageSquare className="h-10 w-10 text-white" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-display text-2xl font-bold text-foreground">{platformName}</h1>
          <p className="text-sm text-muted-foreground">CRM omnichannel com IA</p>
        </div>
        <div className="mt-8 flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary/40"
              style={{ animation: `splash-dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes splash-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}

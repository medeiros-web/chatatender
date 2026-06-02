import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

interface Props {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  className?: string
  threshold?: number
}

export function PullToRefresh({ onRefresh, children, className, threshold = 72 }: Props) {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return
    const el = e.currentTarget as HTMLElement
    if (el.scrollTop > 0) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setPullY(Math.min(delta * 0.5, threshold + 20))
  }

  const onTouchEnd = async () => {
    pulling.current = false
    if (pullY >= threshold) {
      setRefreshing(true)
      setPullY(threshold)
      await onRefresh()
      setRefreshing(false)
    }
    setPullY(0)
  }

  const progress = Math.min(pullY / threshold, 1)

  return (
    <div
      className={cn('relative overflow-y-auto', className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute inset-x-0 top-0 flex justify-center overflow-hidden transition-all duration-200 pointer-events-none z-10"
        style={{ height: pullY || (refreshing ? threshold : 0) }}
      >
        <div className={cn(
          'mt-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10',
          refreshing && 'animate-spin'
        )}>
          <RefreshCw
            className="h-4 w-4 text-primary"
            style={{ transform: `rotate(${progress * 360}deg)`, transition: refreshing ? 'none' : undefined }}
          />
        </div>
      </div>

      {/* Content offset while pulling */}
      <div style={{ transform: `translateY(${pullY}px)`, transition: pulling.current ? 'none' : 'transform 0.2s ease' }}>
        {children}
      </div>
    </div>
  )
}

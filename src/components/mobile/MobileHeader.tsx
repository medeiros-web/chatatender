import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

interface Props {
  title: string
  back?: boolean
  right?: ReactNode
  className?: string
}

export function MobileHeader({ title, back, right, className }: Props) {
  const navigate = useNavigate()

  return (
    <header className={cn(
      'sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/95 backdrop-blur-md px-4 safe-area-pt',
      className
    )}>
      {back && (
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} className="-ml-1">
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className={cn('flex-1 font-display font-bold text-foreground truncate', back ? 'text-base' : 'text-lg')}>
        {title}
      </h1>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </header>
  )
}

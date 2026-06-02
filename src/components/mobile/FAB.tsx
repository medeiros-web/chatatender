import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Plus, MessageSquarePlus, UserPlus, Calendar, X } from 'lucide-react'
import { haptic } from '@/hooks/usePWA'

const ACTIONS = [
  { icon: UserPlus,         label: 'Novo lead',       to: '/admin/leads?new=1',    color: 'bg-blue-500' },
  { icon: MessageSquarePlus,label: 'Nova conversa',   to: '/admin/inbox?new=1',    color: 'bg-green-500' },
  { icon: Calendar,         label: 'Agendar',         to: '/admin/calendar?new=1', color: 'bg-orange-500' },
]

export function FAB() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const toggle = () => {
    haptic('medium')
    setOpen(v => !v)
  }

  const handleAction = (to: string) => {
    haptic('light')
    setOpen(false)
    navigate(to)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3">
        {/* Sub-actions */}
        {open && ACTIONS.map(({ icon: Icon, label, to, color }, i) => (
          <button
            key={to}
            onClick={() => handleAction(to)}
            className={cn(
              'flex items-center gap-2 rounded-full shadow-lg px-4 py-2.5 text-white text-sm font-medium',
              'transition-all duration-200 translate-y-0 opacity-100',
              color
            )}
            style={{
              transitionDelay: `${i * 40}ms`,
              animation: 'fab-item-in 0.2s ease-out',
            }}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}

        {/* Main FAB */}
        <button
          onClick={toggle}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full shadow-xl',
            'bg-primary text-white transition-all duration-200',
            open && 'rotate-45 bg-destructive'
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      <style>{`
        @keyframes fab-item-in {
          from { opacity: 0; transform: translateY(8px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}

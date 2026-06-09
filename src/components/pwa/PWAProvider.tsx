import { createContext, useContext, type ReactNode } from 'react'
import { usePWA, type PWAState } from '@/hooks/usePWA'
import { OfflineIndicator } from './OfflineIndicator'
import { UpdatePrompt } from './UpdatePrompt'

const PWAContext = createContext<PWAState | null>(null)

export function usePWAContext() {
  const ctx = useContext(PWAContext)
  if (!ctx) throw new Error('usePWAContext must be used inside PWAProvider')
  return ctx
}

interface Props {
  children: ReactNode
}

export function PWAProvider({ children }: Props) {
  const pwa = usePWA()

  return (
    <PWAContext.Provider value={pwa}>
      <OfflineIndicator isOnline={pwa.isOnline} />
      {children}
      <UpdatePrompt hasUpdate={pwa.hasUpdate} onApply={pwa.applyUpdate} />
    </PWAContext.Provider>
  )
}

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface PWAState {
  isInstalled: boolean
  canInstall: boolean
  swRegistered: boolean
  isOnline: boolean
  hasUpdate: boolean
  swVersion: string | null
  install: () => Promise<boolean>
  applyUpdate: () => void
  requestNotificationPermission: () => Promise<NotificationPermission>
}

export function usePWA(): PWAState {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled]     = useState(false)
  const [swRegistered, setSwRegistered]   = useState(false)
  const [isOnline, setIsOnline]           = useState(navigator.onLine)
  const [hasUpdate, setHasUpdate]         = useState(false)
  const [swVersion, setSwVersion]         = useState<string | null>(null)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    // ── Service Worker registration ──────────────────────────────────────────
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(registration => {
          setSwRegistered(true)

          // Check for waiting worker on initial load
          if (registration.waiting) {
            setWaitingWorker(registration.waiting)
            setHasUpdate(true)
          }

          // Detect new SW installing
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (!newWorker) return
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker)
                setHasUpdate(true)
              }
            })
          })

          // Periodic update check every 30 min
          const interval = setInterval(() => registration.update(), 30 * 60 * 1000)
          return () => clearInterval(interval)
        })
        .catch(console.error)

      // SW sent a message (e.g. SW_UPDATED after activate)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          setSwVersion(event.data.version ?? null)
        }
        if (event.data?.type === 'BG_SYNC') {
          window.dispatchEvent(new CustomEvent('pwa:bgsync', { detail: event.data }))
        }
      })
    }

    // ── Standalone detection ─────────────────────────────────────────────────
    const mq = window.matchMedia('(display-mode: standalone)')
    const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
    setIsInstalled(mq.matches || iosStandalone)
    const onMqChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches)
    mq.addEventListener('change', onMqChange)

    // ── Install prompt ───────────────────────────────────────────────────────
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })

    // ── Online / offline ─────────────────────────────────────────────────────
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      mq.removeEventListener('change', onMqChange)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const install = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
    return outcome === 'accepted'
  }, [installPrompt])

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
    setHasUpdate(false)
    window.location.reload()
  }, [waitingWorker])

  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied'
    if (Notification.permission === 'granted') return 'granted'
    return Notification.requestPermission()
  }, [])

  return {
    isInstalled,
    canInstall: !!installPrompt && !isInstalled,
    swRegistered,
    isOnline,
    hasUpdate,
    swVersion,
    install,
    applyUpdate,
    requestNotificationPermission,
  }
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if ('vibrate' in navigator) {
    const pattern = style === 'light' ? [10] : style === 'medium' ? [20] : [30, 10, 30]
    navigator.vibrate(pattern)
  }
}

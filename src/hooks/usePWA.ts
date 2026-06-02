import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [swRegistered, setSwRegistered] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(() => setSwRegistered(true))
        .catch(console.error)
    }

    // Detect standalone mode
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsInstalled(mq.matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches)
    mq.addEventListener('change', handler)

    // Capture install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    return () => {
      mq.removeEventListener('change', handler)
      window.removeEventListener('beforeinstallprompt', onPrompt)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
    return outcome === 'accepted'
  }

  return { isInstalled, canInstall: !!installPrompt, install, swRegistered }
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if ('vibrate' in navigator) {
    const pattern = style === 'light' ? [10] : style === 'medium' ? [20] : [30, 10, 30]
    navigator.vibrate(pattern)
  }
}

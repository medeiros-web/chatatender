// ChatAtender Service Worker
// Bump SW_VERSION to force cache refresh on next deploy.
const SW_VERSION = 'v3'
const CACHE_NAME = `chatatender-${SW_VERSION}`
const PRECACHE = [
  '/',
  '/admin',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.png',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      self.clients.claim()
      // Notify all open tabs that a new version is active
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION }))
      })
    })
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET
  if (request.method !== 'GET') return

  // Skip Supabase, external APIs
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('resend.com') ||
    url.hostname.includes('googleapis.com') ||
    url.protocol === 'chrome-extension:'
  ) return

  // HTML navigation: network-first, fallback to cached app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return res
        })
        .catch(() => caches.match('/') || caches.match('/admin'))
    )
    return
  }

  // JS/CSS/fonts: stale-while-revalidate
  if (
    url.pathname.includes('/assets/') ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
          return cached || fetchPromise
        })
      )
    )
    return
  }

  // Images: cache-first
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, res.clone()))
          }
          return res
        })
      })
    )
    return
  }
})

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages())
  }
})

async function syncPendingMessages() {
  // Notify clients to flush any queued offline actions
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach(client => client.postMessage({ type: 'BG_SYNC', tag: 'sync-messages' }))
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch {}

  const title = data.title ?? 'ChatAtender'
  const options = {
    body:    data.body ?? 'Nova notificação',
    icon:    '/icons/icon-192x192.png',
    badge:   '/icons/icon-96x96.png',
    image:   data.image,
    data:    { url: data.url ?? '/admin/notifications', ...data },
    vibrate: [100, 50, 100],
    tag:     data.tag ?? 'chatatender',
    renotify: true,
    actions: data.actions ?? [],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/admin/notifications'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})

// ── Message from app ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

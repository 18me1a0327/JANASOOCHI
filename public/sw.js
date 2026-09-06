const CACHE = 'janasoochi-safe-shell-v3'
const SHELL = ['/offline.html', '/manifest.webmanifest', '/janasoochi-mark-192.png', '/janasoochi-mark-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Authenticated application responses, voter data and PDFs are deliberately
  // network-only. The PWA cache contains only a non-sensitive offline shell.
  if (url.pathname.startsWith('/api/') || url.pathname.includes('voter-pdfs')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }
  if (!SHELL.includes(url.pathname)) return
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
})

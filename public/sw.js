// Service worker de MallPlay: permite instalar la app y abrirla rápido (o sin conexión).
// Páginas: primero la red (siempre la versión publicada más nueva) y, sin conexión, la copia guardada.
// Archivos del sitio (JS/CSS con hash, íconos, fuentes): copia guardada y se refresca por detrás.
// Nada de Supabase ni otros servicios se guarda aquí.
const CACHE = 'cm-v2'
const SCOPE = new URL(self.registration.scope)
const SHELL = new URL('./', SCOPE).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const sameSite = (url) => url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname)
const fonts = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (req.mode === 'navigate' && sameSite(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          if (res.ok) caches.open(CACHE).then((c) => c.put(SHELL, copy))
          return res
        })
        .catch(() => caches.match(SHELL)),
    )
    return
  }

  if (sameSite(url) || fonts(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req)
        const net = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') c.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || net
      }),
    )
  }
})

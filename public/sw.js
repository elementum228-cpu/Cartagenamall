// Service worker de MallPlay: permite instalar la app y abrirla rápido (o sin conexión).
// Páginas: primero la red (siempre la versión publicada más nueva) y, sin conexión, la copia guardada.
// Archivos con hash en el nombre (assets/*-hash.js|css|woff2…) nunca cambian: copia guardada primero, sin volver a pedirlos.
// Otros archivos del sitio (íconos, manifiesto): copia guardada y se refresca por detrás.
// Nada de Supabase ni otros servicios se guarda aquí.
const CACHE = 'cm-v4'
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

// La presentación privada (carpeta «presentacion/») es otra aplicación en el mismo sitio: este service worker no la toca.
const sameSite = (url) => url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname) && !url.pathname.startsWith(SCOPE.pathname + 'presentacion/')
const fonts = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'

// Cada publicación trae archivos con hash nuevos: se descartan los más viejos para que el caché no crezca sin fin en celulares con poco espacio.
async function trim(cache, max = 140) {
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) if (new URL(k.url).href !== SHELL) await cache.delete(k)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Archivos grandes o con rangos (audio, modelo y motor de recorte de fotos): los maneja el navegador.
  if (/\/(audio|models|ort)\//.test(url.pathname)) return

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

  if (sameSite(url) && /\/assets\/.+-[\w-]{8}\.(js|css|woff2?|png|webp|avif|svg|jpg)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) {
          c.put(req, res.clone())
          trim(c)
        }
        return res
      }),
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

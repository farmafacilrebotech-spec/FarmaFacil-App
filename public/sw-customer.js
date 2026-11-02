/* FarmaFácil customer PWA — solo recursos estáticos seguros.
 * Scope del registro: '/' (cubre /cuenta y /e/{publicId}).
 * No intercepta navegación de documentos: /cuenta y /e/… van siempre a red.
 * No cachea HTML ni respuestas autenticadas (perfil, direcciones, pedidos).
 */
const CACHE = 'ff-customer-static-v1';
const PRECACHE = [
  '/manifest.webmanifest',
  '/icons/pwa-192.png',
  '/icons/pwa-512.png',
  '/icons/apple-touch-180.png',
  '/images/logos/farmafacil-mark.png',
  '/images/logos/farmafacil-favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ff-customer-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  if (
    path.startsWith('/icons/') ||
    path.startsWith('/images/logos/') ||
    path === '/manifest.webmanifest' ||
    path === '/favicon.png' ||
    path === '/favicon.svg'
  ) {
    return true;
  }
  // Chunks estáticos de Next (sin HTML de página).
  if (path.startsWith('/_next/static/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Nunca interceptar navegación de documentos (evita caché de /cuenta, /e/…).
  if (req.mode === 'navigate' || req.destination === 'document') {
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) {
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })
  );
});

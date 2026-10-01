/**
 * CapaSuite Service Worker
 * Gestiona el caché offline y las actualizaciones de la PWA.
 */

const CACHE_NAME = 'capasuite-v12';

// Recursos que se cachean en la instalación (shell de la app)
const STATIC_ASSETS = [
  './index.html',
  './AnalisisSegmentos.html',
  './AnalisisCompetencia.html',
  './AnalisisIA.html',
  './AnalisisPersonal.html',
  './AnalisisProduccion.html',
  './CalculadoraPresupuesto.html',
  './CargarDatos.html',
  './manifest.json',
  './Imagen/icon-192.png',
  './Imagen/icon-512.png',
  './css/tokens.css',
  './css/nav.css',
  './partials/nav.html',
  './js/nav.js',
  './js/xlsx.full.min.js',
  './Analisis360.html',
  './AnalisisCalendario.html',
  './SeguimientoRevenue.html',
  './js/revenue-history.js',
  './js/revenue-review.js',
  './js/revenue-dashboard.js',
  './css/revenue-dashboard.css',
  './js/storage.js',
  './js/theme-manager.js',
  './js/state.js',
  './js/chart.js',
  './js/segment-analysis.js',
  './js/segment-dashboard.js',
  './js/segment-review.js',
  './js/production-groups.js',
];

// ── Instalación: pre-cachear el shell ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando assets estáticos');
      // Usamos addAll con manejo de errores individuales para que un fallo
      // en un recurso no rompa toda la instalación.
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] No se pudo cachear ${url}:`, err)
          )
        )
      );
    })
  );
  // Activar el nuevo SW sin esperar a que se cierren las pestañas actuales
  self.skipWaiting();
});

// ── Activación: limpiar cachés antiguas ────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('capasuite-') && key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Tomar control inmediato de todas las páginas
  self.clients.claim();
});

// ── Fetch: Network-first con fallback a caché ──────────────────────────────
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o que sean de Firebase/Google APIs
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cloud responses must not be stored as application assets.
  if (url.origin !== self.location.origin) return;

  // Para recursos locales: Network-first con fallback a caché
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Mensaje para forzar actualización desde la UI ──────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

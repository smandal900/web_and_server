// Service worker of the phone app (/app/): makes it installable, opens it without a network, keeps thumbnails, and
// receives photos shared to it. Registered by src/pwa.ts (production builds, https or localhost only).
const SHELL = 'pwa-shell-v1';
const THUMBS = 'pwa-thumbs-v1'; // private pictures: the app deletes this cache when the session ends
const SHARED = 'pwa-shared-v1'; // files shared to the app, waiting to be uploaded
const MAX_THUMBS = 800;
const MAX_SHELL = 100;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/app/', '/app/manifest.webmanifest', '/app/favicon.svg', '/app/icons/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('pwa-') && ![SHELL, THUMBS, SHARED].includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Stores a response and drops the oldest entries beyond `max` (a cache lists them in the order they were added). */
async function put(name, request, response, max) {
  const cache = await caches.open(name);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

/** The app's page: from the server when it answers, otherwise the copy from last time. */
async function page(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) await put(SHELL, '/app/', response.clone(), MAX_SHELL);
    return response;
  } catch (error) {
    const cached = await caches.match('/app/', { cacheName: SHELL });
    if (cached) return cached;
    throw error;
  }
}

/** Files under assets/ have a hash in their name, so a cached copy never goes stale. */
async function fixed(request) {
  const cached = await caches.match(request, { cacheName: SHELL });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await put(SHELL, request, response.clone(), MAX_SHELL);
  return response;
}

/** A thumbnail is shown from the cache at once and refreshed behind it (an edited photo gets a new one). */
async function thumbnail(event) {
  const cached = await caches.match(event.request, { cacheName: THUMBS });
  const fresh = fetch(event.request).then(async (response) => {
    if (response.ok) await put(THUMBS, event.request, response.clone(), MAX_THUMBS);
    return response;
  });
  if (!cached) return fresh;
  event.waitUntil(fresh.catch(() => undefined));
  return cached;
}

/** "Share" from the phone's gallery: keep the files, then open the app, which uploads them. */
async function receiveShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARED);
  const files = form.getAll('media').filter((f) => f && typeof f !== 'string');
  await Promise.all(
    files.map((file, i) =>
      cache.put(
        `/app/shared/${Date.now()}-${i}`,
        new Response(file, { headers: { 'content-type': file.type, 'x-file-name': encodeURIComponent(file.name), 'x-modified': String(file.lastModified) } }),
      ),
    ),
  );
  return Response.redirect('/app/', 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method === 'POST' && url.pathname === '/app/share-target') return event.respondWith(receiveShare(request));
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' && url.pathname.startsWith('/app/')) return event.respondWith(page(request));
  if (url.pathname.startsWith('/app/assets/')) return event.respondWith(fixed(request));
  if (/^\/api\/assets\/[^/]+\/thumbnail$/.test(url.pathname) && url.searchParams.get('size') === 'thumbnail') {
    return event.respondWith(thumbnail(event));
  }
  // everything else of the API always comes from the server
});

// The service worker: opens the page without the bridge. It keeps one build as a whole, taken when
// it is installed; every build has a worker of its own, as its name is in it.
import { cacheName, filesToKeep, handlingOf, oldCaches, PAGE_TIMEOUT_MS } from './rules.js';

declare const self: ServiceWorkerGlobalScope;

async function install(): Promise<void> {
  const manifest = await fetch('/build.json', { cache: 'no-store' });
  const files = filesToKeep(await manifest.json(), __BUILD__);
  const cache = await caches.open(cacheName(__BUILD__));
  await cache.addAll(files.map((file) => new Request(file, { cache: 'reload' })));
  await self.skipWaiting();
}

async function activate(): Promise<void> {
  await Promise.all(oldCaches(await caches.keys(), __BUILD__).map((name) => caches.delete(name)));
  await self.clients.claim();
}

const kept = async (file: string): Promise<Response | undefined> =>
  (await caches.open(cacheName(__BUILD__))).match(file);

/** Nothing of the answer is kept: it may be another build's, and the address may have a token. */
async function page(request: Request): Promise<Response> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), PAGE_TIMEOUT_MS);
  try {
    const response = await fetch(request, { signal: timeout.signal });
    if (response.ok) return response;
    return (await kept('/')) ?? response;
  } catch {
    return (await kept('/')) ?? Response.error();
  } finally {
    clearTimeout(timer);
  }
}

const asset = async (request: Request): Promise<Response> =>
  (await kept(new URL(request.url).pathname)) ?? fetch(request);

self.addEventListener('install', (e) => e.waitUntil(install()));
self.addEventListener('activate', (e) => e.waitUntil(activate()));
self.addEventListener('fetch', (e) => {
  const handling = handlingOf(e.request, self.location.origin);
  if (handling) e.respondWith(handling === 'page' ? page(e.request) : asset(e.request));
});

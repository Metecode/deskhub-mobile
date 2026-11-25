// What the service worker does with a request. Kept apart from it to be tested.

export type Handling =
  /** From the bridge if it answers soon, else the copy. */
  | 'page'
  /** The copy: a file with a hash in its name never changes. */
  | 'asset';

/** How long the bridge has to answer before the page comes from the copy, ms. */
export const PAGE_TIMEOUT_MS = 2000;

export interface RequestFacts {
  method: string;
  /** Request.mode */
  mode: string;
  url: string;
}

/** null: none of its business, the browser goes on as if it weren't there. */
export function handlingOf({ method, mode, url }: RequestFacts, origin: string): Handling | null {
  if (method !== 'GET' || !URL.canParse(url)) return null;
  const target = new URL(url);
  if (target.origin !== origin) return null;
  // With a token in the address too: it is answered, but nothing of it is kept.
  if (mode === 'navigate') return target.pathname === '/' ? 'page' : null;
  return target.pathname.startsWith('/assets/') && target.search === '' ? 'asset' : null;
}

export const cacheName = (build: string): string => `deskhub-mobile ${build}`;

/** Caches of this app, but of other builds. */
export const oldCaches = (names: readonly string[], build: string): string[] =>
  names.filter((name) => name.startsWith(cacheName('')) && name !== cacheName(build));

/** What to keep, from build.json (vite.config.ts). Throws unless it is of this build. */
export function filesToKeep(manifest: unknown, build: string): string[] {
  const { build: found, files } = (manifest ?? {}) as { build?: unknown; files?: unknown };
  if (found !== build || !Array.isArray(files)) throw new Error(`build.json isn't of build ${build}`);
  const assets = files.filter((f): f is string => typeof f === 'string' && /^\/assets\/[\w.-]+$/.test(f));
  return ['/', ...assets];
}

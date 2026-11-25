// The built web app, held in memory as one whole. A new build takes its place once it is complete
// (its build.json is written last), so nobody gets half of one, and the bridge needn't be restarted.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';
import type { Logger } from './log.js';

export interface WebFile {
  body: Buffer;
  headers: Record<string, string>;
}

const TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const PAGE = '/index.html';
const BUILD = '/build.json';
/** Vite puts a content hash in the names in here. */
const HASHED = '/assets/';

type Files = ReadonlyMap<string, WebFile>;

function read(root: string): Map<string, WebFile> {
  const files = new Map<string, WebFile>();
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    const path = `/${file.slice(join(root, sep).length).replaceAll(sep, '/')}`;
    const body = readFileSync(file);
    files.set(path, {
      body,
      headers: {
        'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
        'Content-Length': String(body.length),
        'Cache-Control': path.startsWith(HASHED) ? 'public, max-age=31536000, immutable' : 'no-cache',
      },
    });
  }
  return files;
}

/** Changes with every build; null while there is none, or not all of it. */
function stamp(root: string): string | null {
  try {
    const { mtimeMs, size } = statSync(join(root, BUILD));
    return `${mtimeMs} ${size}`;
  } catch {
    return null;
  }
}

export class WebFiles {
  readonly #root: string;
  readonly #log: Logger;
  #files: Files = new Map();
  /** Of the build before: pages opened with it may still ask for them. */
  #older: Files = new Map();
  #stamp: string | null = null;
  #build: string | null = null;

  constructor(root: string, log: Logger) {
    this.#root = root;
    this.#log = log;
  }

  /** The current build's name, null: there is none. */
  get build(): string | null {
    this.#refresh();
    return this.#build;
  }

  /** Whether there is a web app at all. */
  get built(): boolean {
    this.#refresh();
    return this.#files.has(PAGE);
  }

  /** `path` as in the address, not decoded: no file needs that. */
  get(path: string): WebFile | undefined {
    this.#refresh();
    const name = path === '/' ? PAGE : path;
    return this.#files.get(name) ?? (name.startsWith(HASHED) ? this.#older.get(name) : undefined);
  }

  #refresh(): void {
    const found = stamp(this.#root);
    if (found === null || found === this.#stamp) return;
    // Not again for the same one, should it not be readable.
    this.#stamp = found;
    try {
      const files = read(this.#root);
      const { build } = JSON.parse(files.get(BUILD)!.body.toString('utf8')) as { build?: unknown };
      if (typeof build !== 'string') throw new Error('build.json has no build');
      if (this.#build) this.#log.info(`serving the new build ${build}`);
      this.#older = this.#files;
      this.#files = files;
      this.#build = build;
    } catch (e) {
      this.#log.warn(`the web app can't be read: ${(e as Error).message}`);
    }
  }
}

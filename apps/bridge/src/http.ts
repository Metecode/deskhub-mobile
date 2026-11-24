// Plain HTTP: the built web app, and safe answers where the board has endpoints that
// make no sense here.
import { existsSync } from 'node:fs';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { join } from 'node:path';
import sirv from 'sirv';
import { parseTarget } from './target.js';
import { tokensEqual } from './tokens.js';

const DEBUG_ENDPOINTS = new Set(['/screenshot', '/tap', '/perf']);

function text(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers }).end(`${body}\n`);
}

/**
 * The board's Wi-Fi update endpoint. The upstream flasher (companion/deskhub/
 * flash_cli.py) tries to flash over USB instead on 404, on 5xx, on a 403 that
 * mentions a token and on a dropped connection; on any other 403 it just stops.
 * So the upload is read to the end, thrown away and refused.
 */
function refuseFirmware(req: IncomingMessage, res: ServerResponse): void {
  req.on('error', () => res.destroy());
  req.on('end', () => text(res, 403, 'firmware updates are not possible on deskhub-mobile', { Connection: 'close' }));
  req.resume();
}

export function createHttpHandler(options: { hubToken: string; webRoot: string }): RequestListener {
  const { hubToken, webRoot } = options;
  const serve = existsSync(join(webRoot, 'index.html'))
    ? sirv(webRoot, {
        setHeaders: (res, path) => {
          // Vite puts a content hash in the names under assets/.
          const hashed = path.startsWith('/assets/');
          res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      })
    : null;

  return (req, res) => {
    const { pathname, params } = parseTarget(req.url);
    if (req.method === 'POST' && pathname === '/firmware') return refuseFirmware(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return text(res, 405, 'method not allowed', { Allow: 'GET, HEAD', Connection: 'close' });
    if (DEBUG_ENDPOINTS.has(pathname)) {
      return tokensEqual(params.get('token'), hubToken)
        ? text(res, 501, 'not available on deskhub-mobile')
        : text(res, 403, 'bad token');
    }
    if (serve) return serve(req, res, () => text(res, 404, 'not found'));
    // deskhub-setup checks that "/" answers with a status below 500.
    if (pathname === '/') return text(res, 200, 'deskhub-mobile bridge: the web app is not built, run "pnpm build"');
    text(res, 404, 'not found');
  };
}

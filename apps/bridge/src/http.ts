// Plain HTTP: the built web app, and safe answers where the board has endpoints that
// make no sense here.
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { parseTarget } from './target.js';
import { tokensEqual } from './tokens.js';
import type { WebFiles } from './webFiles.js';

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

export function createHttpHandler(options: { hubToken: string; web: WebFiles }): RequestListener {
  const { hubToken, web } = options;

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
    const file = web.get(pathname);
    if (file) return void res.writeHead(200, file.headers).end(req.method === 'HEAD' ? undefined : file.body);
    // deskhub-setup checks that "/" answers with a status below 500.
    if (pathname === '/' && !web.built)
      return text(res, 200, 'deskhub-mobile bridge: the web app is not built, run "pnpm build"');
    text(res, 404, 'not found');
  };
}

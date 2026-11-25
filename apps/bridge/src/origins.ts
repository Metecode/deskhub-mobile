// Who may open /ws, and which web pages may open /client. Browsers always send an Origin header, so
// this keeps other sites from using the phone's (or the PC's) browser to reach the bridge.
import type { IncomingMessage } from 'node:http';
import { hostname, networkInterfaces } from 'node:os';

/** The Vite dev server's port (apps/web/vite.config.ts). */
export const DEV_PORT = 5173;

/** This PC's IPv4 addresses on its networks. */
export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

/**
 * The allowed origins: this PC under every name a phone may use, on the bridge's
 * port and the Vite dev port, plus the extra ones. "localhost" is also what a phone
 * uses through `adb reverse`. Computed on demand because addresses change.
 */
export function allowedOrigins(port: number, extra: readonly string[] = []): Set<string> {
  const name = hostname().toLowerCase();
  const hosts = ['localhost', '127.0.0.1', ...lanAddresses(), name, `${name}.local`];
  const origins = new Set(extra);
  for (const host of hosts) for (const p of [port, DEV_PORT]) origins.add(new URL(`http://${host}:${p}`).origin);
  return origins;
}

/**
 * The companion is a program on this PC: both ends of its connection have the same address, whichever
 * of the PC's that is. A web page opened here has that too, but also an Origin header.
 */
export function fromThisPc({ headers, socket }: IncomingMessage): boolean {
  return headers.origin === undefined && socket.remoteAddress !== undefined && socket.remoteAddress === socket.localAddress;
}

/** Parses CLIENT_ORIGINS, a comma separated list like "http://hub.lan:8765". Throws on a bad one. */
export function parseOrigins(list: string): string[] {
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const url = URL.canParse(s) ? new URL(s) : null;
      if (!url || !/^https?:$/.test(url.protocol) || url.pathname !== '/' || url.search || url.hash)
        throw new Error(`CLIENT_ORIGINS: "${s}" is not an origin like http://192.168.1.20:8765`);
      return url.origin;
    });
}

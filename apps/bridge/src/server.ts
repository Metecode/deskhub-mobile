// The bridge: one HTTP server for the companion, phones and the web app.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CompanionEndpoint } from './companionEndpoint.js';
import { Hub } from './hub.js';
import type { Logger } from './log.js';

export interface BridgeOptions {
  hubToken: string;
  log: Logger;
}

export class Bridge {
  readonly hub = new Hub();
  readonly companion: CompanionEndpoint;
  readonly #server: Server;

  constructor(options: BridgeOptions) {
    this.companion = new CompanionEndpoint(this.hub, options.hubToken, options.log);
    this.#server = createServer((_req, res) => {
      res.writeHead(404).end();
    });
    this.#server.on('upgrade', (req, socket, head) => {
      socket.on('error', () => socket.destroy());
      const { pathname } = new URL(req.url ?? '/', 'http://bridge');
      if (pathname === '/ws') this.companion.upgrade(req, socket, head);
      else socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    });
  }

  /** The port it listens on, which is only known after listen(). */
  get port(): number {
    return (this.#server.address() as AddressInfo).port;
  }

  listen(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.once('error', reject);
      this.#server.listen(port, host, () => {
        this.#server.off('error', reject);
        resolve();
      });
    });
  }

  close(): Promise<void> {
    this.companion.close();
    this.hub.disconnected();
    this.#server.closeAllConnections();
    return new Promise((resolve) => this.#server.close(() => resolve()));
  }
}

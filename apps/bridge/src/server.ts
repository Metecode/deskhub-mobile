// The bridge: one HTTP server for the companion, phones and the web app.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import type { WeatherSettings } from '@deskhub-mobile/protocol';
import { ClientEndpoint } from './clientEndpoint.js';
import { CompanionEndpoint } from './companionEndpoint.js';
import { createHttpHandler } from './http.js';
import { Hub } from './hub.js';
import type { Logger } from './log.js';
import { allowedOrigins } from './origins.js';
import { parseTarget } from './target.js';
import { WebFiles } from './webFiles.js';

export interface BridgeOptions {
  hubToken: string;
  clientToken: string;
  /** Origins allowed on /client besides this PC's own. */
  clientOrigins: readonly string[];
  /** For phones to get the weather with. null: not set. */
  weather: WeatherSettings | null;
  /** The built web app. */
  webRoot: string;
  log: Logger;
}

export class Bridge {
  readonly hub = new Hub();
  readonly companion: CompanionEndpoint;
  readonly clients: ClientEndpoint;
  readonly #server: Server;

  constructor(options: BridgeOptions) {
    const { hubToken, clientToken, clientOrigins, weather, webRoot, log } = options;
    const web = new WebFiles(webRoot, log);
    this.companion = new CompanionEndpoint(this.hub, hubToken, log);
    this.clients = new ClientEndpoint({
      hub: this.hub,
      token: clientToken,
      originAllowed: (origin) => allowedOrigins(this.port, clientOrigins).has(origin),
      weather,
      build: () => web.build,
      sendCommand: (command) => this.companion.send(command),
      log,
    });
    this.#server = createServer(createHttpHandler({ hubToken, web }));
    this.#server.on('upgrade', (req, socket, head) => this.#onUpgrade(req, socket, head));
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
    this.clients.close();
    this.hub.disconnected();
    this.#server.closeAllConnections();
    return new Promise((resolve) => this.#server.close(() => resolve()));
  }

  #onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    socket.on('error', () => socket.destroy());
    const { pathname } = parseTarget(req.url);
    if (pathname === '/ws') this.companion.upgrade(req, socket, head);
    else if (pathname === '/client') this.clients.upgrade(req, socket, head);
    else socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  }
}

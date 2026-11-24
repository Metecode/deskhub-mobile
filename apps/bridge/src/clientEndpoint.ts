// /client: phones and browsers. They get a snapshot, then live messages, and may
// send whitelisted commands.
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  CLOSE_BAD_ORIGIN,
  CLOSE_BAD_TOKEN,
  parseCommand,
  STATUS_INTERVAL_MS,
  TOKEN_PARAM,
  type Command,
  type StatusMessage,
} from '@deskhub-mobile/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Hub } from './hub.js';
import type { Logger } from './log.js';
import { parseTarget } from './target.js';
import { tokensEqual } from './tokens.js';

/** Largest frame from a phone. Commands are far smaller. */
const MAX_CLIENT_FRAME = 4096;
/** A phone this far behind is gone or hopelessly slow. */
const MAX_BUFFERED = 1024 * 1024;

export interface ClientEndpointOptions {
  hub: Hub;
  token: string;
  /** Called for every connection that has an Origin header. */
  originAllowed: (origin: string) => boolean;
  /** Passes a command on. False when there's no companion to take it. */
  sendCommand: (command: Command) => boolean;
  log: Logger;
}

export class ClientEndpoint {
  readonly #options: ClientEndpointOptions;
  readonly #wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CLIENT_FRAME, perMessageDeflate: false });
  /** Clients that passed the checks. */
  readonly #clients = new Set<WebSocket>();
  readonly #heartbeat: NodeJS.Timeout;

  constructor(options: ClientEndpointOptions) {
    this.#options = options;
    this.#wss.on('connection', (ws, req) => this.#onConnection(ws, req));
    options.hub.on('message', (text) => this.#broadcast(text));
    options.hub.on('status', () => this.#broadcast(this.#status()));
    // Also while the PC is offline, so phones can tell that from losing the bridge.
    this.#heartbeat = setInterval(() => this.#broadcast(this.#status()), STATUS_INTERVAL_MS);
  }

  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.#wss.handleUpgrade(req, socket, head, (ws) => this.#wss.emit('connection', ws, req));
  }

  close(): void {
    clearInterval(this.#heartbeat);
    for (const ws of this.#wss.clients) ws.terminate();
    this.#wss.close();
  }

  #onConnection(ws: WebSocket, req: IncomingMessage): void {
    const { hub, log, originAllowed, token } = this.#options;
    ws.on('error', (e) => log.warn(`client socket: ${e.message}`));

    // Refused with a close code rather than an HTTP status, because a page can't
    // read the status and couldn't tell the user what's wrong.
    const { origin } = req.headers;
    if (origin !== undefined && !originAllowed(origin)) {
      log.warn(`/client: origin ${origin} is not allowed (see CLIENT_ORIGINS)`);
      ws.close(CLOSE_BAD_ORIGIN, 'origin not allowed');
      return;
    }
    const given = parseTarget(req.url).params.get(TOKEN_PARAM);
    if (!tokensEqual(given, token)) {
      log.warn('/client: wrong or missing token');
      ws.close(CLOSE_BAD_TOKEN, 'wrong token');
      return;
    }

    this.#clients.add(ws);
    log.info(`client connected (${this.#clients.size} now)`);
    ws.on('close', () => {
      this.#clients.delete(ws);
      log.info(`client disconnected (${this.#clients.size} now)`);
    });
    ws.on('message', (data: Buffer, isBinary) => {
      if (ws.readyState === ws.OPEN && !isBinary) this.#onCommand(data.toString('utf8'));
    });
    // The messages are JSON texts already.
    ws.send(`{"type":"bridge.snapshot","pc_online":${hub.online},"messages":[${hub.messages.join(',')}]}`);
  }

  #onCommand(text: string): void {
    const { log, sendCommand } = this.#options;
    const command = parseCommand(text);
    if (!command) {
      log.warn(`command refused: ${JSON.stringify(text.slice(0, 100))}`);
      return;
    }
    const sent = sendCommand(command);
    log.info(`command ${command.type}${sent ? '' : ' dropped, no companion connected'}`);
  }

  #status(): string {
    return JSON.stringify({ type: 'bridge.status', pc_online: this.#options.hub.online } satisfies StatusMessage);
  }

  #broadcast(text: string): void {
    for (const ws of this.#clients) {
      if (ws.bufferedAmount > MAX_BUFFERED) ws.terminate();
      else if (ws.readyState === ws.OPEN) ws.send(text);
    }
  }
}

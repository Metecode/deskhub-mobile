// /ws: behaves like the board's WebSocket endpoint.
// Source: firmware/main/hub_server.c, ws_handler, on_text and on_binary.
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  CLOSE_REPLACED,
  HUB_VERSION,
  MAX_FRAME,
  PREAUTH_MAX,
  parseArtFrame,
  parseCompanionMessage,
  type Command,
  type HelloOkMessage,
} from '@deskhub-mobile/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Hub } from './hub.js';
import type { Logger } from './log.js';
import { tokensEqual } from './tokens.js';

// Close codes for what makes the board drop a connection.
const CLOSE_POLICY = 1008;
const CLOSE_TOO_BIG = 1009;

export class CompanionEndpoint {
  readonly #hub: Hub;
  readonly #token: string;
  readonly #log: Logger;
  readonly #wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME, perMessageDeflate: false });
  /** The companion that said hello. */
  #companion: WebSocket | null = null;
  /** Message types already mentioned in the log, so each is logged once. */
  readonly #logged = new Set<string>();

  constructor(hub: Hub, token: string, log: Logger) {
    this.#hub = hub;
    this.#token = token;
    this.#log = log;
    this.#wss.on('connection', (ws) => this.#onConnection(ws));
  }

  get connected(): boolean {
    return this.#companion !== null;
  }

  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.#wss.handleUpgrade(req, socket, head, (ws) => this.#wss.emit('connection', ws, req));
  }

  /** Sends a command, like hub_server_send(). False when there's no companion. */
  send(message: Command | HelloOkMessage): boolean {
    if (!this.#companion) return false;
    this.#companion.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    for (const ws of this.#wss.clients) ws.terminate();
    this.#wss.close();
  }

  #onConnection(ws: WebSocket): void {
    ws.on('message', (data: Buffer, isBinary) => this.#onFrame(ws, data, isBinary));
    ws.on('error', (e) => this.#log.warn(`companion socket: ${e.message}`));
    ws.on('close', () => {
      if (ws !== this.#companion) return;
      this.#log.info('companion disconnected');
      this.#drop();
    });
  }

  #onFrame(ws: WebSocket, data: Buffer, isBinary: boolean): void {
    // Frames already in flight on a connection that is being closed.
    if (ws.readyState !== ws.OPEN || data.length === 0) return;
    // Until a socket says hello, only accept a frame big enough for the hello itself.
    if (ws !== this.#companion && data.length > PREAUTH_MAX) {
      this.#log.warn(`/ws: ${data.length} byte frame before hello, closing`);
      ws.close(CLOSE_TOO_BIG, 'frame too big before hello');
      return;
    }
    if (isBinary) this.#onBinary(ws, data);
    else this.#onText(ws, data.toString('utf8'));
  }

  #onText(ws: WebSocket, text: string): void {
    const parsed = parseCompanionMessage(text);
    if (parsed.kind === 'invalid') {
      this.#log.warn('/ws: bad json');
      return;
    }
    if (parsed.type === 'hello') {
      this.#onHello(ws, parsed.raw.token);
      return;
    }
    // Ignore everything from sockets that have not said hello.
    if (ws !== this.#companion) return;

    this.#hub.touch();
    if (parsed.kind === 'mismatch') {
      this.#logOnce(`mismatch:${parsed.type}`, () =>
        this.#log.warn(`${parsed.type} doesn't fit its schema, relayed as it is: ${parsed.issues}`),
      );
    } else if (parsed.kind === 'unknown') {
      this.#logOnce(`unknown:${parsed.type}`, () =>
        this.#log.info(`message type "${parsed.type}" is unknown, relayed as it is`),
      );
    }
    this.#hub.publish(parsed.type, text);
  }

  #onHello(ws: WebSocket, token: unknown): void {
    if (!tokensEqual(token, this.#token)) {
      this.#log.warn('/ws: wrong token');
      if (ws === this.#companion) this.#drop();
      ws.close(CLOSE_POLICY, 'wrong token');
      return;
    }
    const previous = this.#companion;
    this.#companion = ws;
    // The companion takes the first message it receives as the answer to its hello.
    this.send({ type: 'hello_ok', version: HUB_VERSION });
    this.#hub.touch();
    if (previous && previous !== ws) {
      this.#log.info('a new companion connected, closing the previous one');
      previous.close(CLOSE_REPLACED, 'replaced by another companion');
    }
    this.#log.info('companion connected');
  }

  #onBinary(ws: WebSocket, data: Buffer): void {
    if (ws !== this.#companion) return;
    const frame = parseArtFrame(data);
    if (!frame) {
      // Doesn't keep the PC online.
      this.#log.warn(`bad binary frame, ${data.length} bytes`);
      return;
    }
    this.#hub.touch();
    const kind = frame.magic === 'STM1' ? ` kind ${frame.kind}` : '';
    this.#log.info(`${frame.magic} id ${frame.id} ${frame.width}x${frame.height}${kind}`);
    this.#hub.publishCover(frame, data);
  }

  #drop(): void {
    this.#companion = null;
    this.#hub.disconnected();
  }

  #logOnce(key: string, write: () => void): void {
    if (this.#logged.has(key)) return;
    this.#logged.add(key);
    write();
  }
}

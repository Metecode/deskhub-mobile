// Helpers for the bridge tests: real sockets on port 0, fake timers.
import { vi } from 'vitest';
import { WebSocket, type ClientOptions } from 'ws';
import { silentLogger } from './log.js';
import { Bridge, type BridgeOptions } from './server.js';

export const HUB_TOKEN = 'hub-secret';

/** Fakes timers and Date only, so sockets keep working. */
export function useFakeTimers(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
}

export async function startBridge(options: Partial<BridgeOptions> = {}): Promise<Bridge> {
  const bridge = new Bridge({ hubToken: HUB_TOKEN, log: silentLogger, ...options });
  await bridge.listen(0, '127.0.0.1');
  return bridge;
}

export interface Closed {
  code: number;
  reason: string;
}

/** A WebSocket client that queues what it receives. */
export class TestSocket {
  readonly ws: WebSocket;
  readonly received: string[] = [];
  readonly closed: Promise<Closed>;
  #waiting: (() => void)[] = [];

  constructor(port: number, path: string, options?: ClientOptions) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, options);
    this.ws.on('error', () => {});
    this.ws.on('message', (data) => {
      this.received.push(String(data));
      for (const wake of this.#waiting.splice(0)) wake();
    });
    this.closed = new Promise((resolve) =>
      this.ws.on('close', (code, reason) => resolve({ code, reason: String(reason) })),
    );
  }

  open(): Promise<this> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve(this));
      this.ws.once('error', reject);
    });
  }

  /** The next message, decoded. The test's own timeout applies. */
  async next(): Promise<any> {
    while (this.received.length === 0) await new Promise<void>((resolve) => this.#waiting.push(resolve));
    return JSON.parse(this.received.shift()!);
  }

  /** The next message that passes, dropping the ones before it. */
  async until(test: (message: any) => boolean): Promise<any> {
    for (;;) {
      const message = await this.next();
      if (test(message)) return message;
    }
  }

  send(message: object | string | Uint8Array): void {
    this.ws.send(typeof message === 'string' || message instanceof Uint8Array ? message : JSON.stringify(message));
  }

  /** Resolves once the server has handled everything sent so far (it answers pings in order). */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.ws.once('pong', () => resolve());
      this.ws.ping();
    });
  }
}

/** A companion that has said hello. */
export async function connectCompanion(bridge: Bridge): Promise<TestSocket> {
  const socket = await new TestSocket(bridge.port, '/ws').open();
  socket.send({ type: 'hello', token: HUB_TOKEN });
  await socket.next();
  return socket;
}

/** A text message of exactly `bytes` bytes. */
export function paddedMessage(type: string, bytes: number): string {
  const empty = JSON.stringify({ type, pad: '' });
  return JSON.stringify({ type, pad: 'x'.repeat(bytes - empty.length) });
}

/** A picture frame with the given magic. `extra` bytes make it invalid. */
export function artFrame(magic: 'ART1' | 'ARS1' | 'STM1', extra = 0): Uint8Array {
  const [w, h] = [4, 4];
  const data = Buffer.alloc((magic === 'STM1' ? 16 : 12) + w * h * 2 + extra);
  data.write(magic, 'latin1');
  data.writeUInt32LE(7, 4);
  data.writeUInt16LE(w, 8);
  data.writeUInt16LE(h, 10);
  return data;
}

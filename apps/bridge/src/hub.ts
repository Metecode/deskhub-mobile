// What the board keeps in RAM: the last message of every type, the last covers, and
// whether the PC is online.
import { EventEmitter } from 'node:events';
import { ONLINE_TIMEOUT_MS } from '@deskhub-mobile/protocol';

// Not state: nothing to show, so not relayed and not in the snapshot.
const NOT_STATE = new Set(['', 'hello', 'hello_ok', 'ping']);

/** Covers that phones get: the PC's and the media server's. */
export type CoverMagic = 'ART1' | 'ARS1';

interface HubEvents {
  /** The text of a companion message to relay. */
  message: [text: string];
  /** A valid cover frame to relay. */
  cover: [frame: Buffer];
  status: [online: boolean];
}

export class Hub extends EventEmitter<HubEvents> {
  #online = false;
  #timer: NodeJS.Timeout | undefined;
  readonly #messages = new Map<string, string>();
  readonly #covers = new Map<CoverMagic, Buffer>();

  get online(): boolean {
    return this.#online;
  }

  /** The last message of every type, as received, in the order the types first came. */
  get messages(): string[] {
    return [...this.#messages.values()];
  }

  /** The last cover of each kind, as received. */
  get covers(): Buffer[] {
    return [...this.#covers.values()];
  }

  /** Something arrived from the companion: the PC is online for another while. */
  touch(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#setOnline(false), ONLINE_TIMEOUT_MS);
    this.#setOnline(true);
  }

  /** The companion's connection is gone. Its data stays, as on the board. */
  disconnected(): void {
    clearTimeout(this.#timer);
    this.#setOnline(false);
  }

  /** Remembers and relays a companion message. `text` must be valid JSON. */
  publish(type: string, text: string): void {
    if (NOT_STATE.has(type)) return;
    this.#messages.set(type, text);
    this.emit('message', text);
  }

  /** Remembers and relays a cover. `frame` must be valid. */
  publishCover(magic: CoverMagic, frame: Buffer): void {
    this.#covers.set(magic, frame);
    this.emit('cover', frame);
  }

  #setOnline(online: boolean): void {
    if (online === this.#online) return;
    this.#online = online;
    this.emit('status', online);
  }
}

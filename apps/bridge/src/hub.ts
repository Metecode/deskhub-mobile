// What the board keeps in RAM: the last message of every type, and whether the PC
// is online.
import { EventEmitter } from 'node:events';
import { ONLINE_TIMEOUT_MS } from '@deskhub-mobile/protocol';

// Not state: nothing to show, so not relayed and not in the snapshot.
const NOT_STATE = new Set(['', 'hello', 'hello_ok', 'ping']);

interface HubEvents {
  /** The text of a companion message to relay. */
  message: [text: string];
  status: [online: boolean];
}

export class Hub extends EventEmitter<HubEvents> {
  #online = false;
  #timer: NodeJS.Timeout | undefined;
  readonly #messages = new Map<string, string>();

  get online(): boolean {
    return this.#online;
  }

  /** The last message of every type, as received, in the order the types first came. */
  get messages(): string[] {
    return [...this.#messages.values()];
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

  #setOnline(online: boolean): void {
    if (online === this.#online) return;
    this.#online = online;
    this.emit('status', online);
  }
}

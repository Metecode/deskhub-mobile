// What the board keeps in RAM: the last message of every type, the last covers, and
// whether the PC is online.
import { EventEmitter } from 'node:events';
import { addPortrait, normalizeSteam, ONLINE_TIMEOUT_MS, STEAM_PORTRAIT, type ArtFrame } from '@deskhub-mobile/protocol';

// Not state: nothing to show, so not relayed and not in the snapshot.
const NOT_STATE = new Set(['', 'hello', 'hello_ok', 'ping']);

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
  /** By what they show: ART1, ARS1, and STM1 with its kind. */
  readonly #covers = new Map<string, Buffer>();
  /** Of recent games, by app id. */
  #portraits = new Map<number, Buffer>();

  get online(): boolean {
    return this.#online;
  }

  /** The last message of every type, as received, in the order the types first came. */
  get messages(): string[] {
    return [...this.#messages.values()];
  }

  /** The last cover of each kind, and the portraits of games, as received. */
  get covers(): Buffer[] {
    return [...this.#covers.values(), ...this.#portraits.values()];
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

  /** Remembers and relays a cover. `header` is what parseArtFrame() says about the frame. */
  publishCover(header: ArtFrame, frame: Buffer): void {
    if (header.magic !== 'STM1') this.#covers.set(header.magic, frame);
    else if (header.kind !== STEAM_PORTRAIT) this.#covers.set(`STM1 ${header.kind}`, frame);
    else this.#portraits = addPortrait(this.#portraits, header.id, frame, this.#recentGames());
    this.emit('cover', frame);
  }

  #recentGames(): Set<number> {
    const text = this.#messages.get('steam');
    return new Set(text && normalizeSteam(JSON.parse(text)).recent.map((game) => game.appid));
  }

  #setOnline(online: boolean): void {
    if (online === this.#online) return;
    this.#online = online;
    this.emit('status', online);
  }
}

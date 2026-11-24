// The connection to the bridge: reconnects by itself and holds the latest data.
import {
  CLOSE_BAD_ORIGIN,
  CLOSE_BAD_TOKEN,
  normalizeStats,
  SILENCE_TIMEOUT_MS,
  TOKEN_PARAM,
  type BridgeMessage,
  type RawMessage,
  type Stats,
} from '@deskhub-mobile/protocol';

/** How far back the history goes. */
export const HISTORY_MS = 60_000;

const BACKOFF_MIN_MS = 500;
const BACKOFF_MAX_MS = 15_000;

export type Link =
  | 'connecting'
  | 'open'
  /** No token, or the bridge refused it. Waits for setToken(). */
  | 'bad_token'
  /** The bridge doesn't allow this page's origin. Retrying won't help. */
  | 'bad_origin';

export interface HistoryPoint {
  /** When it arrived, ms. */
  t: number;
  cpu: number;
  gpu: number | null;
}

export interface BridgeState {
  link: Link;
  /** As last reported. Only means something while the link is open. */
  pcOnline: boolean;
  stats: Stats | null;
  /** The last minute, oldest first. */
  history: readonly HistoryPoint[];
  /** The last message of every type, as received. */
  messages: Readonly<Record<string, RawMessage>>;
}

/** Delay before reconnect attempt `attempt` (0, 1, 2...): doubles, with jitter, up to a limit. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const full = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** Math.min(attempt, 10));
  return full * (0.5 + random() / 2);
}

export class Connection {
  #state: BridgeState = { link: 'connecting', pcOnline: false, stats: null, history: [], messages: {} };
  readonly #listeners = new Set<() => void>();
  readonly #url: string;
  #token: string | null;
  #socket: WebSocket | null = null;
  #attempt = 0;
  #retry: ReturnType<typeof setTimeout> | undefined;
  #watchdog: ReturnType<typeof setTimeout> | undefined;

  /** `url` is the /client address without the token. */
  constructor(url: string, token: string | null) {
    this.#url = url;
    this.#token = token;
  }

  // Arrow functions, so they can go straight to useSyncExternalStore().
  readonly getState = (): BridgeState => this.#state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  setToken(token: string): void {
    this.#token = token;
    this.#attempt = 0;
    this.connect();
  }

  /** Connects now, dropping whatever connection or wait there is. */
  connect(): void {
    this.#drop();
    if (!this.#token) {
      this.#update({ link: 'bad_token' });
      return;
    }
    this.#update({ link: 'connecting' });
    const socket = new WebSocket(`${this.#url}?${TOKEN_PARAM}=${encodeURIComponent(this.#token)}`);
    this.#socket = socket;
    socket.onmessage = (e) => this.#onMessage(e.data);
    socket.onclose = (e) => this.#onClose(e.code);
    this.#feedWatchdog();
  }

  /** Cuts a wait for the next attempt short, e.g. when the screen turns on. */
  wake(): void {
    if (this.#retry === undefined) return;
    this.#attempt = 0;
    this.connect();
  }

  #onMessage(data: unknown): void {
    this.#feedWatchdog();
    let message: RawMessage;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (typeof message?.type !== 'string') return;

    if (message.type === 'bridge.snapshot' || message.type === 'bridge.status') {
      this.#onBridgeMessage(message as unknown as BridgeMessage);
      return;
    }
    const messages = { ...this.#state.messages, [message.type]: message };
    if (message.type !== 'stats') {
      this.#update({ messages });
      return;
    }
    const stats = normalizeStats(message);
    const t = Date.now();
    const history = this.#state.history.filter((p) => p.t > t - HISTORY_MS && p.t <= t);
    history.push({ t, cpu: stats.cpu, gpu: stats.gpu });
    this.#update({ messages, stats, history });
  }

  #onBridgeMessage(message: BridgeMessage): void {
    if (message.type === 'bridge.status') {
      this.#update({ pcOnline: message.pc_online });
      return;
    }
    // The bridge let us in.
    this.#attempt = 0;
    const messages = Object.fromEntries(message.messages.map((m) => [m.type, m]));
    this.#update({
      link: 'open',
      pcOnline: message.pc_online,
      messages,
      // Not part of the history: there's no telling how old it is.
      stats: messages.stats ? normalizeStats(messages.stats) : null,
    });
  }

  #onClose(code: number): void {
    this.#drop();
    if (code === CLOSE_BAD_TOKEN) return this.#update({ link: 'bad_token' });
    if (code === CLOSE_BAD_ORIGIN) return this.#update({ link: 'bad_origin' });
    this.#update({ link: 'connecting' });
    this.#retry = setTimeout(() => this.connect(), backoffDelay(this.#attempt++));
  }

  /**
   * The bridge sends a heartbeat even while the PC is offline, so silence means the
   * bridge is out of reach. A socket on a lost Wi-Fi connection may never close by itself.
   */
  #feedWatchdog(): void {
    clearTimeout(this.#watchdog);
    this.#watchdog = setTimeout(() => this.#onClose(0), SILENCE_TIMEOUT_MS);
  }

  /** Forgets the socket without waiting for it to close. */
  #drop(): void {
    clearTimeout(this.#retry);
    clearTimeout(this.#watchdog);
    this.#retry = undefined;
    const socket = this.#socket;
    this.#socket = null;
    if (!socket) return;
    socket.onmessage = socket.onclose = null;
    socket.close();
  }

  #update(change: Partial<BridgeState>): void {
    this.#state = { ...this.#state, ...change };
    for (const listener of this.#listeners) listener();
  }
}

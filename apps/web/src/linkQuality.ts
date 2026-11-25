// How good the connection to the bridge is: how long its answers take, and whether they come. A page
// can't read the Wi-Fi's signal strength, but this is what a weak signal leads to.
import { Store } from './store.js';

export const PING_MS = 5000;

/** An answer that takes longer is lost. */
export const LOST_MS = 3000;

/** How many pings count. */
export const SAMPLES = 6;

/** A median up to this is good, up to the next one fair. To be set on the phone: its Wi-Fi saves power. */
export const GOOD_MS = 150;
export const FAIR_MS = 400;

/** A new level must come out this many times in a row. */
const STEADY = 2;

export type LinkLevel = 'good' | 'fair' | 'poor';

export interface LinkState {
  level: LinkLevel;
  /** The median, ms. null: nothing has been answered yet. */
  ms: number | null;
  /** Of the last pings. */
  lost: number;
}

const FIRST: LinkState = { level: 'good', ms: null, lost: 0 };

/** ms, null for a lost one. */
export type Sample = number | null;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function levelOf(samples: readonly Sample[]): LinkLevel {
  const lost = samples.filter((s) => s === null).length;
  const ms = median(samples.filter((s) => s !== null));
  if (lost >= 2 || (ms !== null && ms > FAIR_MS)) return 'poor';
  return lost === 1 || (ms !== null && ms > GOOD_MS) ? 'fair' : 'good';
}

export class LinkStore extends Store<LinkState> {
  readonly #send: (id: number) => boolean;
  #samples: Sample[] = [];
  #id = 0;
  #sentAt: number | null = null;
  #lostTimer: ReturnType<typeof setTimeout> | undefined;
  /** A level that isn't shown yet, and how often it came out. */
  #next: { level: LinkLevel; times: number } = { level: 'good', times: 0 };

  /** `send` sends a ping, false: there is no connection. */
  constructor(send: (id: number) => boolean) {
    super(FIRST);
    this.#send = send;
  }

  /** To be called every PING_MS while the page can be seen. */
  readonly ping = (): void => {
    if (this.#sentAt !== null) return;
    if (!this.#send(++this.#id)) return;
    this.#sentAt = performance.now();
    this.#lostTimer = setTimeout(() => this.#add(null), LOST_MS);
  };

  /** An answer. */
  readonly pong = (id: number): void => {
    if (id === this.#id && this.#sentAt !== null) this.#add(Math.max(0, performance.now() - this.#sentAt));
  };

  /** The connection is gone, or the page can't be seen: what was measured doesn't count. */
  readonly reset = (): void => {
    this.#stop();
    this.#samples = [];
    this.#next = { level: 'good', times: 0 };
    this.setState(FIRST);
  };

  #stop(): void {
    clearTimeout(this.#lostTimer);
    this.#sentAt = null;
  }

  #add(sample: Sample): void {
    this.#stop();
    this.#samples = [...this.#samples, sample].slice(-SAMPLES);
    const level = levelOf(this.#samples);
    this.#next = { level, times: level === this.#next.level ? this.#next.times + 1 : 1 };
    const known = this.#samples.filter((s) => s !== null);
    this.setState({
      level: this.#next.times >= STEADY ? level : this.getState().level,
      ms: median(known),
      lost: this.#samples.length - known.length,
    });
  }
}

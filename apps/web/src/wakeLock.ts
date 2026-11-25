// Keeps the screen on. Only in a secure context, and only while the page can be seen.
import { Store } from './store.js';

export type WakeLockState =
  /** The browser has none, or this isn't a secure context. */
  | { status: 'unavailable' }
  | { status: 'off' }
  /** Waits for the page to be seen, or for the browser's answer. */
  | { status: 'waiting' }
  /** `since` in ms. */
  | { status: 'held'; since: number }
  /** For example while the battery is low. */
  | { status: 'refused'; reason: string };

/** The part of WakeLockSentinel that is needed. */
interface Lock {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface WakeLockEnvironment {
  /** null: there is none. */
  request: (() => Promise<Lock>) | null;
  visible: () => boolean;
}

const OFF: WakeLockState = { status: 'off' };
const WAITING: WakeLockState = { status: 'waiting' };

export const wakeLockEnvironment = (): WakeLockEnvironment => ({
  request: 'wakeLock' in navigator ? () => navigator.wakeLock.request('screen') : null,
  visible: () => document.visibilityState === 'visible',
});

export class WakeLockStore extends Store<WakeLockState> {
  readonly #environment: WakeLockEnvironment;
  #wanted = false;
  #requesting = false;
  #lock: Lock | null = null;

  constructor(environment: WakeLockEnvironment) {
    super(environment.request ? OFF : { status: 'unavailable' });
    this.#environment = environment;
  }

  readonly start = (): void => {
    this.#wanted = true;
    void this.update();
  };

  readonly stop = (): void => {
    this.#wanted = false;
    const lock = this.#lock;
    this.#lock = null;
    if (this.#environment.request) this.setState(OFF);
    void lock?.release().catch(() => {});
  };

  /** Takes the lock if it should be there and isn't: the browser lets go of it when the page is hidden. */
  async update(): Promise<void> {
    const { request, visible } = this.#environment;
    if (!request || !this.#wanted || this.#lock || this.#requesting) return;
    this.setState(WAITING);
    if (!visible()) return;
    this.#requesting = true;
    try {
      const lock = await request();
      if (!this.#wanted) return void lock.release().catch(() => {});
      this.#lock = lock;
      lock.addEventListener('release', () => {
        if (this.#lock !== lock) return;
        this.#lock = null;
        this.setState(WAITING);
        void this.update();
      });
      this.setState({ status: 'held', since: Date.now() });
    } catch (e) {
      if (this.#wanted) this.setState({ status: 'refused', reason: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    } finally {
      this.#requesting = false;
    }
  }
}

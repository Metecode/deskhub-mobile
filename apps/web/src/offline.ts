// The service worker (sw/sw.ts), which opens the page without the bridge.
import { describeError } from './diagnostics.js';
import { Store } from './store.js';

export type OfflineState =
  /** The browser has none, or this isn't a secure context. */
  | { status: 'unavailable' }
  /** The dev server has none. */
  | { status: 'off' }
  | { status: 'starting' }
  /** The page opens without the bridge. */
  | { status: 'active' }
  | { status: 'failed'; reason: string };

export class OfflineStore extends Store<OfflineState> {
  readonly #enabled: boolean;

  constructor(enabled: boolean) {
    super({ status: 'off' });
    this.#enabled = enabled;
  }

  async start(): Promise<void> {
    if (!('serviceWorker' in navigator)) return this.setState({ status: 'unavailable' });
    if (!this.#enabled) return;
    this.setState({ status: 'starting' });
    try {
      // Always asked for, never from the browser's cache: a new build is a new worker.
      await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      this.setState({ status: 'active' });
    } catch (e) {
      this.setState({ status: 'failed', reason: describeError(e) });
    }
  }
}

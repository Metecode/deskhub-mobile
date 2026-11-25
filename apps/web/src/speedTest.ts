// The speed test's button (run_cb in firmware/main/ui_net.c). The companion ignores a
// request within 2 minutes of the last one without saying so, so the phone locks the button.
import type { Net } from '@deskhub-mobile/protocol';
import { loadJson, saveJson } from './saved.js';
import { Store } from './store.js';
import { T } from './text.js';
import { formatDuration } from './time.js';

/** SPEEDTEST_MIN_GAP_S in companion/deskhub/__main__.py. */
export const SPEED_TEST_LOCK_MS = 120_000;

const KEY = 'deskhub-mobile.speedtest';

/** When this phone last asked for a test, ms; 0 if never. */
export class SpeedTestStore extends Store<number> {
  constructor() {
    const saved = loadJson(KEY);
    super(typeof saved === 'number' ? saved : 0);
  }

  requested(): void {
    const now = Date.now();
    saveJson(KEY, now);
    this.setState(now);
  }
}

/** ms until the button works again. */
export function lockLeft(requestedAt: number, now: number): number {
  const passed = now - requestedAt;
  return passed >= 0 && passed < SPEED_TEST_LOCK_MS ? SPEED_TEST_LOCK_MS - passed : 0;
}

/** `netAt` and `now` in ms. */
export function speedTestButton(net: Net, netAt: number, requestedAt: number, now: number, online: boolean) {
  if (net.testing) return { label: T.net.testingShort, disabled: true };
  const left = lockLeft(requestedAt, now);
  // Until the next message, as on the board.
  if (left && requestedAt > netAt) return { label: T.net.starting, disabled: true };
  if (left) return { label: T.net.again(formatDuration(Math.ceil(left / 1000))), disabled: true };
  return { label: T.net.run, disabled: !online };
}

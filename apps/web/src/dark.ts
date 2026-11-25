// The dark screen while the PC's display sleeps and at night (dark_mode and idle_check in
// firmware/main/display.c).
import type { DarkStyle, Layout, Night } from '@deskhub-mobile/protocol';
import { Store } from './store.js';

/** How long a touch wakes the screen. */
export const WAKE_MS = 60_000;

export interface DarkReasons extends Pick<Layout, 'pcSleep' | 'night'> {
  /** The PC's display sleeps. */
  asleep: boolean;
}

/** `now` in ms. By the phone's clock, also across midnight. */
export function isNight({ start, end }: Night, now: number): boolean {
  if (start < 0 || end < 0 || start === end) return false;
  const d = new Date(now);
  const minute = d.getHours() * 60 + d.getMinutes();
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** Why and how it should be dark. The PC's sleep goes before the night. */
export function darkMode({ asleep, pcSleep, night }: DarkReasons, now: number): DarkStyle | null {
  if (asleep && pcSleep !== 'none') return pcSleep;
  return isNight(night, now) ? night.style : null;
}

/** How the screen is dark now, or null. */
export class DarkStore extends Store<DarkStyle | null> {
  #reasons: DarkReasons;
  #mode: DarkStyle | null = null;
  #lastTouch = -Infinity;

  constructor(reasons: DarkReasons) {
    super(null);
    this.#reasons = reasons;
  }

  start(): void {
    setInterval(this.tick, 1000);
    this.tick();
  }

  update(reasons: DarkReasons): void {
    const { asleep, pcSleep, night } = this.#reasons;
    if (asleep === reasons.asleep && pcSleep === reasons.pcSleep && night === reasons.night) return;
    this.#reasons = reasons;
    this.tick();
  }

  /** A touch, an alert or the timer: light for a while. */
  readonly wake = (): void => {
    this.#lastTouch = Date.now();
    this.tick();
  };

  readonly tick = (): void => {
    const now = Date.now();
    const mode = darkMode(this.#reasons, now);
    // Dark at once, whenever the last touch was.
    if (mode && !this.#mode) this.#lastTouch = -Infinity;
    this.#mode = mode;
    const awake = now - this.#lastTouch <= WAKE_MS && now >= this.#lastTouch;
    this.setState(awake ? null : mode);
  };
}

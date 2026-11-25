// Swiping between the dock's pages: what a finger's way means. The dock does the same with a touch.

/** Closer to the screen's edge it is Android's own gesture, px. */
export const EDGE = 24;

/** How far a finger goes before its direction counts, px. */
export const SLOP = 12;

/** To the next page from this share of the width... */
const FAR = 1 / 4;
/** ...or with a flick this fast (px/ms) and at least this long (px). */
const FLICK_SPEED = 0.5;
const FLICK_MIN = 30;

/** What is left of the way beyond the first and the last page. */
const RESISTANCE = 0.25;

export const SETTLE_MS = 200;

export const mayStart = (x: number, screenWidth: number): boolean => x >= EDGE && x <= screenWidth - EDGE;

/** Scrolling goes first: it is only a swipe when it is clearly sideways. null: not far enough to tell. */
export function axisOf(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return null;
  return Math.abs(dx) > 1.5 * Math.abs(dy) ? 'x' : 'y';
}

export interface Neighbours {
  previous: boolean;
  next: boolean;
}

/** Where the page is while the finger is `dx` from where it started. */
export function offsetOf(dx: number, { previous, next }: Neighbours): number {
  return (dx > 0 && !previous) || (dx < 0 && !next) ? dx * RESISTANCE : dx;
}

/** -1: the previous page, 1: the next, 0: stay. `speed` in px/ms, with a sign as `dx`. */
export function targetOf(dx: number, speed: number, width: number, { previous, next }: Neighbours): -1 | 0 | 1 {
  const flick = Math.abs(speed) >= FLICK_SPEED && Math.abs(dx) >= FLICK_MIN;
  // A flick back takes it back, however far it is.
  if (flick && Math.sign(speed) !== Math.sign(dx)) return 0;
  if (!flick && Math.abs(dx) < width * FAR) return 0;
  if (dx > 0) return previous ? -1 : 0;
  return next ? 1 : 0;
}

/** The speed of the last 100 ms. */
export class SpeedMeter {
  #points: { t: number; x: number }[] = [];

  add(t: number, x: number): void {
    this.#points = [...this.#points.filter((p) => t - p.t <= 100), { t, x }];
  }

  /** px/ms; 0 when the finger has rested before it left. */
  speed(now: number): number {
    const recent = this.#points.filter((p) => now - p.t <= 100);
    const [first, last] = [recent[0], recent.at(-1)];
    return first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
  }
}

// Against burn-in on an OLED screen: what stands still moves a little every minute, and is dimmed
// when nobody has touched the screen for a while. The board has an LCD and nothing of the kind.
import { Store } from './store.js';

/** How long after the last touch it is dimmed. */
export const DIM_AFTER_MS = 2 * 60_000;

/** "Time's up" is dimmed this long after it came or was touched. */
export const TIMES_UP_DIM_MS = 10 * 60_000;

/** How far from its place it moves, CSS px. */
export const SHIFT_MAX = 4;
const STEP = 2;
const SHIFT_MS = 60_000;

export interface Shift {
  x: number;
  y: number;
}

const CENTRE: Shift = { x: 0, y: 0 };

/** Around a square, one step after the other. */
export const SHIFTS: readonly Shift[] = (() => {
  const path: Shift[] = [];
  for (let v = -SHIFT_MAX; v < SHIFT_MAX; v += STEP) path.push({ x: v, y: -SHIFT_MAX });
  for (let v = -SHIFT_MAX; v < SHIFT_MAX; v += STEP) path.push({ x: SHIFT_MAX, y: v });
  for (let v = SHIFT_MAX; v > -SHIFT_MAX; v -= STEP) path.push({ x: v, y: SHIFT_MAX });
  for (let v = SHIFT_MAX; v > -SHIFT_MAX; v -= STEP) path.push({ x: -SHIFT_MAX, y: v });
  return path;
})();

export const shiftAt = (now: number): Shift => SHIFTS[Math.floor(now / SHIFT_MS) % SHIFTS.length] ?? CENTRE;

export interface BurnInState {
  shift: Shift;
  dim: boolean;
}

export class BurnInStore extends Store<BurnInState> {
  #lastTouch = Date.now();
  /** Fingers on the screen. */
  readonly #down = new Set<number>();

  constructor() {
    super({ shift: CENTRE, dim: false });
  }

  /** ms. */
  get lastTouch(): number {
    return this.#lastTouch;
  }

  start(): void {
    setInterval(this.tick, 1000);
    this.tick();
  }

  readonly down = (pointer: number): void => {
    this.#down.add(pointer);
    this.wake();
  };

  readonly up = (pointer: number): void => {
    this.#down.delete(pointer);
    this.wake();
  };

  /** The page was left: ends of touches may have been missed. */
  readonly forget = (): void => this.#down.clear();

  /** A touch, an alert or the timer's end. */
  readonly wake = (): void => {
    this.#lastTouch = Date.now();
    this.tick();
  };

  readonly tick = (): void => {
    const now = Date.now();
    // The clock was set back.
    if (now < this.#lastTouch) this.#lastTouch = now;
    const touched = this.#down.size > 0;
    const old = this.getState();
    // What is under a finger stays there.
    const shift = touched ? old.shift : shiftAt(now);
    const dim = !touched && now - this.#lastTouch >= DIM_AFTER_MS;
    if (shift !== old.shift || dim !== old.dim) this.setState({ shift, dim });
  };
}

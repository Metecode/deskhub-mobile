import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BurnInStore, DIM_AFTER_MS, SHIFT_MAX, shiftAt, SHIFTS } from './burnIn.js';

const MINUTE = 60_000;
/** The start of the path. */
const START = SHIFTS.length * MINUTE * 1_000_000;

describe('the path', () => {
  it('never leaves its place by more than the limit', () => {
    for (const { x, y } of SHIFTS) expect(Math.max(Math.abs(x), Math.abs(y))).toBe(SHIFT_MAX);
  });

  it('goes round in small steps, through every place once', () => {
    SHIFTS.forEach((a, i) => {
      const b = SHIFTS[(i + 1) % SHIFTS.length]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(2);
    });
    expect(new Set(SHIFTS.map(({ x, y }) => `${x} ${y}`)).size).toBe(SHIFTS.length);
    expect(SHIFTS).toHaveLength(16);
  });

  it('moves once a minute', () => {
    expect(shiftAt(START)).toBe(SHIFTS[0]);
    expect(shiftAt(START + MINUTE - 1)).toBe(SHIFTS[0]);
    expect(shiftAt(START + MINUTE)).toBe(SHIFTS[1]);
    expect(shiftAt(START + 16 * MINUTE)).toBe(SHIFTS[0]);
  });
});

describe('BurnInStore', () => {
  let store: BurnInStore;
  beforeEach(() => {
    vi.useFakeTimers({ now: START });
    store = new BurnInStore();
    store.start();
  });
  afterEach(() => vi.useRealTimers());

  const dim = () => store.getState().dim;

  it('dims after two minutes without a touch', () => {
    vi.advanceTimersByTime(DIM_AFTER_MS - 1000);
    expect(dim()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(dim()).toBe(true);
  });

  it('is bright again at once, for two minutes', () => {
    vi.advanceTimersByTime(DIM_AFTER_MS * 2);
    store.wake();
    expect(dim()).toBe(false);
    vi.advanceTimersByTime(DIM_AFTER_MS - 1000);
    expect(dim()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(dim()).toBe(true);
  });

  it('counts from the end of a touch, and stays where it is until then', () => {
    const { shift } = store.getState();
    store.down(1);
    store.down(2);
    store.up(1);
    vi.advanceTimersByTime(DIM_AFTER_MS * 2);
    expect(dim()).toBe(false);
    expect(store.getState().shift).toBe(shift);
    store.up(2);
    expect(store.getState().shift).not.toBe(shift);
    vi.advanceTimersByTime(DIM_AFTER_MS);
    expect(dim()).toBe(true);
  });

  it('does not wait for a touch whose end it missed', () => {
    store.down(1);
    store.forget();
    vi.advanceTimersByTime(DIM_AFTER_MS);
    expect(dim()).toBe(true);
  });

  it('only tells when something changed', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    vi.advanceTimersByTime(MINUTE - 1000);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('survives a clock that is set back', () => {
    vi.setSystemTime(START - 60 * MINUTE);
    vi.advanceTimersByTime(DIM_AFTER_MS + 1000);
    expect(dim()).toBe(true);
  });
});

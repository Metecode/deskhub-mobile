import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAIR_MS, GOOD_MS, levelOf, LinkStore, LOST_MS, median, PING_MS, SAMPLES } from './linkQuality.js';

describe('median', () => {
  it.each([
    [[], null],
    [[5], 5],
    [[9, 1, 5], 5],
    [[1, 3, 100, 7], 5],
  ])('of %j', (values, result) => expect(median(values)).toBe(result));
});

describe('levelOf', () => {
  it('goes by the median, not by one slow answer', () => {
    expect(levelOf([20, 20, 20, 20, 20, 2000])).toBe('good');
    expect(levelOf([GOOD_MS])).toBe('good');
    expect(levelOf([GOOD_MS + 1])).toBe('fair');
    expect(levelOf([FAIR_MS])).toBe('fair');
    expect(levelOf([FAIR_MS + 1])).toBe('poor');
  });

  it('goes by lost ones, however fast the others are', () => {
    expect(levelOf([10, 10, null])).toBe('fair');
    expect(levelOf([10, 10, null, null])).toBe('poor');
    expect(levelOf([null])).toBe('fair');
  });

  it('is good before anything was measured', () => expect(levelOf([])).toBe('good'));
});

describe('LinkStore', () => {
  let sent: number[];
  let connected: boolean;
  let store: LinkStore;

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    connected = true;
    store = new LinkStore((id) => {
      if (connected) sent.push(id);
      return connected;
    });
  });
  afterEach(() => vi.useRealTimers());

  /** A ping that takes `ms`, or is lost. */
  const measure = (ms: number | null, times = 1) => {
    for (let i = 0; i < times; i++) {
      store.ping();
      vi.advanceTimersByTime(ms ?? LOST_MS);
      if (ms !== null) store.pong(sent.at(-1)!);
      vi.advanceTimersByTime(PING_MS - (ms ?? LOST_MS));
    }
  };

  it('tells how long answers take', () => {
    measure(40, 3);
    expect(store.getState()).toEqual({ level: 'good', ms: 40, lost: 0 });
  });

  it('only changes when it lasts', () => {
    measure(40, 2);
    // Half of them slow: poor for the first time.
    measure(900, 2);
    expect(store.getState()).toEqual({ level: 'good', ms: 470, lost: 0 });
    measure(900);
    expect(store.getState().level).toBe('poor');
    measure(40, 4);
    expect(store.getState().level).toBe('poor');
    measure(40);
    expect(store.getState().level).toBe('good');
  });

  it('forgets what is long past', () => {
    measure(900, SAMPLES);
    measure(40, SAMPLES);
    expect(store.getState()).toEqual({ level: 'good', ms: 40, lost: 0 });
  });

  it('counts answers that do not come, or come too late', () => {
    measure(null, 2);
    store.pong(sent.at(-1)!);
    expect(store.getState()).toMatchObject({ ms: null, lost: 2 });
    measure(null, 2);
    expect(store.getState().level).toBe('poor');
  });

  it('takes no answer to another ping', () => {
    store.ping();
    store.pong(sent.at(-1)! + 1);
    store.pong(0);
    expect(store.getState().ms).toBeNull();
  });

  it('has one ping on its way at most', () => {
    store.ping();
    store.ping();
    expect(sent).toHaveLength(1);
  });

  it('measures nothing without a connection', () => {
    connected = false;
    measure(null, 5);
    expect(store.getState()).toEqual({ level: 'good', ms: null, lost: 0 });
  });

  it('starts over', () => {
    measure(null, 4);
    store.ping();
    store.reset();
    expect(store.getState()).toEqual({ level: 'good', ms: null, lost: 0 });
    vi.advanceTimersByTime(LOST_MS);
    expect(store.getState().lost).toBe(0);
  });
});

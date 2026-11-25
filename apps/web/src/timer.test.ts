import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sound } from './sound.js';
import { TimerStore, timerName } from './timer.js';

const MINUTE = 60_000;
const storage = new Map<string, string>();

beforeEach(() => {
  vi.useFakeTimers();
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function create(onEnd = vi.fn()) {
  const timer = new TimerStore(onEnd);
  timer.resume();
  return { timer, onEnd, state: timer.getState };
}

/** The page is closed, and opened again `ms` later. */
function reload(ms: number, onEnd = vi.fn()) {
  const now = Date.now();
  // This also resets the clock.
  vi.clearAllTimers();
  vi.setSystemTime(now + ms);
  return create(onEnd);
}

describe('TimerStore', () => {
  it('starts at 25 minutes', () => {
    expect(create().state()).toEqual({ status: 'idle', total: 1500, left: 1500, done: false });
  });

  it('counts down and ends', () => {
    const { timer, onEnd, state } = create();
    timer.choose(1);
    timer.toggle();
    expect(state()).toMatchObject({ status: 'running', left: 60 });
    vi.advanceTimersByTime(1000);
    expect(state().left).toBe(59);
    vi.advanceTimersByTime(58_750);
    expect(state().left).toBe(1);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(state()).toEqual({ status: 'idle', total: 60, left: 60, done: true });
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MINUTE);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('pauses and goes on', () => {
    const { timer, onEnd, state } = create();
    timer.choose(1);
    timer.toggle();
    vi.advanceTimersByTime(20_000);
    timer.toggle();
    expect(state()).toMatchObject({ status: 'paused', left: 40 });
    vi.advanceTimersByTime(10 * MINUTE);
    timer.toggle();
    vi.advanceTimersByTime(39_000);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onEnd).toHaveBeenCalled();
  });

  it('restarts with a preset while it runs, otherwise only sets it', () => {
    const { timer, state } = create();
    timer.choose(5);
    expect(state()).toMatchObject({ status: 'idle', total: 300, left: 300 });
    timer.toggle();
    vi.advanceTimersByTime(5000);
    timer.choose(10);
    expect(state()).toMatchObject({ status: 'running', total: 600, left: 600 });
    timer.toggle();
    timer.choose(1);
    expect(state()).toMatchObject({ status: 'idle', left: 60 });
  });

  it('resets', () => {
    const { timer, onEnd, state } = create();
    timer.toggle();
    vi.advanceTimersByTime(5000);
    timer.reset();
    expect(state()).toEqual({ status: 'idle', total: 1500, left: 1500, done: false });
    vi.advanceTimersByTime(30 * MINUTE);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('goes again or is done', () => {
    const { timer, state } = create();
    timer.choose(1);
    timer.toggle();
    vi.advanceTimersByTime(MINUTE);
    timer.again();
    expect(state()).toEqual({ status: 'running', total: 60, left: 60, done: false });
    vi.advanceTimersByTime(MINUTE);
    expect(state().done).toBe(true);
    timer.dismiss();
    expect(state()).toEqual({ status: 'idle', total: 60, left: 60, done: false });
  });

  it('goes on after a reload', () => {
    const first = create();
    first.timer.choose(5);
    first.timer.toggle();
    vi.advanceTimersByTime(10_000);
    const { state, onEnd } = reload(60_000);
    expect(state()).toMatchObject({ status: 'running', total: 300, left: 230 });
    vi.advanceTimersByTime(230_000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps a pause across a reload', () => {
    const first = create();
    first.timer.choose(5);
    first.timer.toggle();
    vi.advanceTimersByTime(10_000);
    first.timer.toggle();
    expect(reload(60 * MINUTE).state()).toEqual({ status: 'paused', total: 300, left: 290, done: false });
  });

  it('has ended when the end passed while the page was closed', () => {
    const first = create();
    first.timer.choose(1);
    first.timer.toggle();
    const { state, onEnd } = reload(10 * MINUTE);
    expect(state()).toEqual({ status: 'idle', total: 60, left: 60, done: true });
    expect(onEnd).toHaveBeenCalledTimes(1);
    // Still there after another reload, until someone taps.
    const { timer, state: later, onEnd: quiet } = reload(MINUTE);
    expect(later().done).toBe(true);
    expect(quiet).not.toHaveBeenCalled();
    timer.dismiss();
    expect(reload(MINUTE).state().done).toBe(false);
  });

  it('ends at once after a nap of the browser', () => {
    const { timer, onEnd, state } = create();
    timer.choose(1);
    timer.toggle();
    vi.setSystemTime(Date.now() + 5 * MINUTE);
    timer.tick();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(state().done).toBe(true);
  });

  it('never has more left than it was set to', () => {
    const first = create();
    first.timer.choose(1);
    first.timer.toggle();
    expect(reload(-60 * MINUTE).state()).toMatchObject({ status: 'running', left: 60 });
  });

  it.each(['nope', '5', '{}', '{"total":-1}', '{"total":60,"status":"running"}', '{"total":60,"left":900}'])(
    'survives %j',
    (text) => {
      storage.set('deskhub-mobile.timer', text);
      const { left, total, status } = create().state();
      expect(left).toBe(total);
      expect(status).toBe('idle');
    },
  );

  it.each([
    ['without Web Audio', undefined],
    [
      'when the browser refuses',
      class {
        constructor() {
          throw new Error('no');
        }
      },
    ],
  ])("says that time is up even %s, and even if it isn't heard", (_name, AudioContext) => {
    vi.stubGlobal('AudioContext', AudioContext);
    const sound = new Sound();
    const first = create();
    first.timer.choose(1);
    first.timer.toggle();
    sound.unlock();
    const { state } = reload(2 * MINUTE, vi.fn(() => sound.play('timer')));
    expect(state().done).toBe(true);
  });
});

describe('timerName', () => {
  it('is in minutes where it can be', () => {
    expect(timerName(1500)).toBe('25 dakikalık sayaç');
    expect(timerName(90)).toBe('90 saniyelik sayaç');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sound } from './sound.js';

/** Stands in for the browser: `allowed` is whether the page was touched. */
class FakeContext {
  static all: FakeContext[] = [];
  static allowed = true;
  state = FakeContext.allowed ? 'running' : 'suspended';
  currentTime = 0;
  destination = {};
  started = 0;
  #waiting: (() => void)[] = [];

  constructor() {
    FakeContext.all.push(this);
  }

  /** Like Chrome, waits for the touch instead of failing. */
  resume(): Promise<void> {
    if (!FakeContext.allowed) return new Promise((resolve) => this.#waiting.push(resolve));
    this.state = 'running';
    for (const resolve of this.#waiting.splice(0)) resolve();
    return Promise.resolve();
  }

  createOscillator() {
    return {
      frequency: { value: 0 },
      connect: <T>(to: T) => to,
      start: () => void this.started++,
      stop: () => {},
    };
  }

  createGain() {
    return {
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: <T>(to: T) => to,
    };
  }
}

const vibrate = vi.fn();
const userActivation = { hasBeenActive: true };
const settled = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  FakeContext.all = [];
  FakeContext.allowed = true;
  userActivation.hasBeenActive = true;
  vibrate.mockReset();
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('navigator', { vibrate, userActivation });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Sound', () => {
  it('beeps and vibrates after a touch', async () => {
    const sound = new Sound();
    sound.unlock();
    sound.play('timer');
    await settled();
    expect(FakeContext.all[0]!.started).toBe(3);
    expect(vibrate).toHaveBeenCalledWith([400, 200, 400, 200, 400]);
    sound.play('alert');
    await settled();
    expect(FakeContext.all[0]!.started).toBe(5);
    expect(vibrate).toHaveBeenLastCalledWith([150, 100, 150]);
  });

  it('makes one AudioContext, and only in a touch', () => {
    const sound = new Sound();
    sound.play('alert');
    expect(FakeContext.all).toHaveLength(0);
    sound.unlock();
    sound.unlock();
    expect(FakeContext.all).toHaveLength(1);
  });

  it('is silent after a reload without a touch', async () => {
    userActivation.hasBeenActive = false;
    const sound = new Sound();
    expect(() => sound.play('timer')).not.toThrow();
    await settled();
    expect(FakeContext.all).toHaveLength(0);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not make up for a missed beep later', async () => {
    FakeContext.allowed = false;
    const sound = new Sound();
    sound.unlock();
    sound.play('timer');
    await vi.advanceTimersByTimeAsync(60_000);
    FakeContext.allowed = true;
    sound.unlock();
    await settled();
    expect(FakeContext.all[0]!.started).toBe(0);
    sound.play('alert');
    await settled();
    expect(FakeContext.all[0]!.started).toBe(2);
  });

  it('wakes a context that the browser suspended', async () => {
    const sound = new Sound();
    sound.unlock();
    FakeContext.all[0]!.state = 'suspended';
    sound.play('timer');
    await settled();
    expect(FakeContext.all[0]!.started).toBe(3);
  });

  it.each([
    ['no Web Audio and no vibration', {}, undefined],
    [
      'refusals',
      {
        userActivation,
        vibrate: () => {
          throw new Error('no');
        },
      },
      class {
        constructor() {
          throw new Error('no');
        }
      },
    ],
    [
      'a context that fails to resume',
      { userActivation, vibrate: () => false },
      class {
        state = 'suspended';
        resume = () => Promise.reject(new Error('no'));
      },
    ],
  ])('survives %s', async (_name, navigator, AudioContext) => {
    vi.stubGlobal('navigator', navigator);
    vi.stubGlobal('AudioContext', AudioContext);
    const sound = new Sound();
    expect(() => {
      sound.unlock();
      sound.play('timer');
    }).not.toThrow();
    await settled();
  });
});

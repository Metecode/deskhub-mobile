import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WakeLockStore } from './wakeLock.js';

class FakeLock {
  released = false;
  #listeners: (() => void)[] = [];
  addEventListener(_type: 'release', listener: () => void) {
    this.#listeners.push(listener);
  }
  /** As the browser does, also by itself when the page is hidden. */
  async release() {
    if (this.released) return;
    this.released = true;
    for (const listener of this.#listeners) listener();
  }
}

let locks: FakeLock[];
let visible: boolean;
let error: Error | null;
const request = vi.fn(async () => {
  if (error) throw error;
  locks.push(new FakeLock());
  return locks.at(-1)!;
});
const make = () => new WakeLockStore({ request, visible: () => visible });
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  locks = [];
  visible = true;
  error = null;
  request.mockClear();
});

describe('WakeLockStore', () => {
  it('says so when there is none, and stays that way', async () => {
    const store = new WakeLockStore({ request: null, visible: () => true });
    store.start();
    await settle();
    expect(store.getState()).toEqual({ status: 'unavailable' });
    store.stop();
    expect(store.getState()).toEqual({ status: 'unavailable' });
  });

  it('takes nothing before it is started', async () => {
    const store = make();
    await store.update();
    expect(request).not.toHaveBeenCalled();
    expect(store.getState().status).toBe('off');
  });

  it('takes one lock, however often it is asked', async () => {
    const store = make();
    store.start();
    store.start();
    void store.update();
    await settle();
    await store.update();
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe('held');
  });

  it('gives it back', async () => {
    const store = make();
    store.start();
    await settle();
    store.stop();
    await settle();
    expect(locks[0]!.released).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe('off');
  });

  it('gives back a lock that came after it was stopped', async () => {
    const store = make();
    store.start();
    store.stop();
    await settle();
    expect(locks[0]!.released).toBe(true);
    expect(store.getState().status).toBe('off');
  });

  it('takes it again when the page is back', async () => {
    const store = make();
    store.start();
    await settle();
    visible = false;
    await locks[0]!.release();
    expect(store.getState().status).toBe('waiting');
    expect(request).toHaveBeenCalledTimes(1);
    visible = true;
    await store.update();
    expect(request).toHaveBeenCalledTimes(2);
    expect(store.getState().status).toBe('held');
  });

  it('takes it again at once when it is lost while the page can be seen', async () => {
    const store = make();
    store.start();
    await settle();
    await locks[0]!.release();
    await settle();
    expect(store.getState().status).toBe('held');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('tells why it was refused, and tries again when asked', async () => {
    const store = make();
    error = new DOMException('low battery', 'NotAllowedError');
    store.start();
    await settle();
    expect(store.getState()).toEqual({ status: 'refused', reason: 'NotAllowedError: low battery' });
    error = null;
    await store.update();
    expect(store.getState().status).toBe('held');
  });
});

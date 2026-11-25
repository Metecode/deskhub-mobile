import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_RELOADS,
  ERROR_WINDOW_MS,
  isCalm,
  SAME_BUILD_MS,
  takeErrorReload,
  takeUpdate,
  UNTOUCHED_MS,
  type UpdateFacts,
} from './reload.js';
import type { TimerState } from './timer.js';

const NOW = 1_800_000_000_000;
let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('isCalm', () => {
  const calm = (alert: unknown, timer: Partial<TimerState>) =>
    isCalm(
      { getState: () => alert as never },
      { getState: () => ({ status: 'idle', total: 60, left: 60, done: false, ...timer }) },
    );

  it('is when nothing is going on', () => {
    expect(calm(null, {})).toBe(true);
    expect(calm(null, { status: 'paused' })).toBe(true);
  });

  it('is not with an active alert, a running timer or one that has ended', () => {
    expect(calm({ id: 'a' }, {})).toBe(false);
    expect(calm(null, { status: 'running' })).toBe(false);
    expect(calm(null, { done: true })).toBe(false);
  });
});

describe('takeUpdate', () => {
  const take = (facts: Partial<UpdateFacts> = {}) =>
    takeUpdate({ own: 'a', served: 'b', calm: true, lastTouch: NOW - UNTOUCHED_MS, now: NOW, ...facts });

  it('takes another build', () => expect(take()).toBe(true));

  it.each<[string, Partial<UpdateFacts>]>([
    ['the same build', { served: 'a' }],
    ['no build', { served: null }],
    ['the dev server', { own: 'dev' }],
    ['an alert or a timer', { calm: false }],
    ['a touch a moment ago', { lastTouch: NOW - UNTOUCHED_MS + 1 }],
  ])('does not with %s, and may later', (_what, facts) => {
    expect(take(facts)).toBe(false);
    expect(take()).toBe(true);
  });

  it('does not wait for a touch that is in the future', () => {
    expect(take({ lastTouch: NOW + 60_000 })).toBe(true);
  });

  it('does not go round in circles when the new build does not come', () => {
    expect(take()).toBe(true);
    expect(take()).toBe(false);
    expect(take({ now: NOW + SAME_BUILD_MS - 1 })).toBe(false);
    expect(take({ now: NOW + SAME_BUILD_MS })).toBe(true);
  });

  it('takes the build after that', () => {
    expect(take()).toBe(true);
    expect(take({ own: 'b', served: 'c' })).toBe(true);
  });

  it.each(['null', '5', '{"build":"b"}', '{"build":"b","at":"x"}', '{'])('survives %j in the storage', (text) => {
    storage.set('deskhub-mobile.update', text);
    expect(take()).toBe(true);
  });
});

describe('takeErrorReload', () => {
  it('stops after a few, until some time has passed', () => {
    for (let i = 0; i < ERROR_RELOADS; i++) expect(takeErrorReload(NOW + i)).toBe(true);
    expect(takeErrorReload(NOW + 10)).toBe(false);
    expect(takeErrorReload(NOW + ERROR_WINDOW_MS - 1)).toBe(false);
    // The first one is over, the others aren't.
    expect(takeErrorReload(NOW + ERROR_WINDOW_MS)).toBe(true);
    expect(takeErrorReload(NOW + ERROR_WINDOW_MS)).toBe(false);
  });

  it.each(['null', '{}', '["x",null]', `[${NOW + 1},${NOW + 2},${NOW + 3}]`, '['])('survives %j in the storage', (text) => {
    storage.set('deskhub-mobile.errorReloads', text);
    expect(takeErrorReload(NOW)).toBe(true);
  });
});

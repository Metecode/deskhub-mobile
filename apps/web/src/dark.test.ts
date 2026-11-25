import type { Night } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { darkMode, DarkStore, isNight, WAKE_MS, type DarkReasons } from './dark.js';

const at = (time: string) => new Date(`2026-11-20T${time}`).getTime();
const NIGHT: Night = { start: 23 * 60, end: 7 * 60, style: 'clock' };
const NO_NIGHT: Night = { start: -1, end: -1, style: 'off' };
const DAY: DarkReasons = { asleep: false, pcSleep: 'off', night: NO_NIGHT };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at('12:00:00'));
});
afterEach(() => vi.useRealTimers());

function start(reasons: DarkReasons = DAY) {
  const dark = new DarkStore(reasons);
  dark.start();
  return dark;
}

describe('isNight', () => {
  it.each([
    ['22:59:59', false],
    ['23:00:00', true],
    ['00:00:00', true],
    ['06:59:59', true],
    ['07:00:00', false],
  ])('across midnight, at %s: %s', (time, night) => expect(isNight(NIGHT, at(time))).toBe(night));

  it.each([
    ['12:59:59', false],
    ['13:00:00', true],
    ['13:59:59', true],
    ['14:00:00', false],
  ])('within a day, at %s: %s', (time, night) =>
    expect(isNight({ start: 13 * 60, end: 14 * 60, style: 'off' }, at(time))).toBe(night),
  );

  it.each([
    [-1, -1],
    [-1, 600],
    [600, -1],
    [600, 600],
  ])('never from %d to %d', (from, to) => {
    expect(isNight({ start: from, end: to, style: 'off' }, at('10:00:00'))).toBe(false);
  });

  it('starts at midnight', () => {
    expect(isNight({ start: 0, end: 60, style: 'off' }, at('00:00:00'))).toBe(true);
  });
});

describe('darkMode', () => {
  it('puts the sleep of the PC before the night', () => {
    const night = { ...DAY, night: NIGHT };
    expect(darkMode({ ...night, asleep: true }, at('23:30:00'))).toBe('off');
    expect(darkMode({ ...night, asleep: true, pcSleep: 'none' }, at('23:30:00'))).toBe('clock');
    expect(darkMode({ ...night, asleep: true, pcSleep: 'none' }, at('12:00:00'))).toBeNull();
    expect(darkMode(DAY, at('12:00:00'))).toBeNull();
  });
});

describe('DarkStore', () => {
  it('is dark at once when the display sleeps, even right after a touch', () => {
    const dark = start();
    dark.wake();
    dark.update({ ...DAY, asleep: true });
    expect(dark.getState()).toBe('off');
  });

  it('is light for 60 seconds after a touch, and longer with more of them', () => {
    const dark = start({ ...DAY, asleep: true });
    dark.wake();
    expect(dark.getState()).toBeNull();
    vi.advanceTimersByTime(WAKE_MS);
    expect(dark.getState()).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(dark.getState()).toBe('off');
    dark.wake();
    vi.advanceTimersByTime(WAKE_MS - 1000);
    dark.wake();
    vi.advanceTimersByTime(WAKE_MS - 1000);
    expect(dark.getState()).toBeNull();
  });

  it('is light again when the display wakes, and dark at once the next time', () => {
    const dark = start({ ...DAY, asleep: true, pcSleep: 'clock' });
    expect(dark.getState()).toBe('clock');
    dark.update({ ...DAY, pcSleep: 'clock' });
    expect(dark.getState()).toBeNull();
    dark.update({ ...DAY, asleep: true, pcSleep: 'clock' });
    expect(dark.getState()).toBe('clock');
  });

  it('follows the clock into the night and out of it, without the PC', () => {
    const dark = start({ ...DAY, night: NIGHT });
    vi.setSystemTime(at('22:59:58'));
    vi.advanceTimersByTime(1000);
    expect(dark.getState()).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(dark.getState()).toBe('clock');
    vi.setSystemTime(at('06:59:59') + 86_400_000);
    vi.advanceTimersByTime(1000);
    expect(dark.getState()).toBeNull();
  });

  it('changes style without getting light in between', () => {
    const dark = start({ ...DAY, asleep: true, night: NIGHT });
    vi.setSystemTime(at('23:30:00'));
    vi.advanceTimersByTime(1000);
    expect(dark.getState()).toBe('off');
    dark.update({ ...DAY, night: NIGHT });
    expect(dark.getState()).toBe('clock');
  });

  it('is dark when the page is opened at night', () => {
    vi.setSystemTime(at('03:00:00'));
    expect(start({ ...DAY, night: NIGHT }).getState()).toBe('clock');
  });

  it('does not stay light when the clock was set back after a touch', () => {
    const dark = start({ ...DAY, asleep: true });
    dark.wake();
    vi.setSystemTime(at('09:00:00'));
    vi.advanceTimersByTime(1000);
    expect(dark.getState()).toBe('off');
  });
});

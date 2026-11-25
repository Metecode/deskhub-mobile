import { normalizeNet } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chartPeak,
  formatAgo,
  formatBytes,
  formatLatency,
  formatMbps,
  formatSpan,
  homeText,
  jitterText,
  latencyColor,
  latencyPath,
  statusText,
} from './internet.js';
import { lockLeft, SPEED_TEST_LOCK_MS, speedTestButton, SpeedTestStore } from './speedTest.js';

const NOW = 1_800_000_000;
const NET = normalizeNet({
  type: 'net',
  online: true,
  latency_ms: 17.5,
  jitter_ms: 2.14,
  loss_pct: 3,
  up_since: NOW - 277_200,
  last_drop: { at: NOW - 277_300, dur_s: 45 },
  speed: { down_mbps: 941.6, up_mbps: 38.1, ping_ms: 9, at: NOW - 7200 },
});

describe('formats', () => {
  it.each([
    [0, '0 KB'],
    [999_000, '999 KB'],
    [35e6, '35 MB'],
    [3.24e9, '3.2 GB'],
    [1.234e12, '1.23 TB'],
  ])('%d bytes: %s', (b, text) => expect(formatBytes(b)).toBe(text));

  it.each([
    [0, 'just now'],
    [59, 'just now'],
    [60, '1m ago'],
    [7200, '2h ago'],
    [200_000, '2d ago'],
  ])('%d s ago: %s', (s, text) => expect(formatAgo(NOW - s, NOW)).toBe(text));

  it('never', () => expect(formatAgo(0, NOW)).toBe('never'));

  it.each([
    [45, '45s'],
    [125, '2m'],
    [3720, '1h 02m'],
    [277_200, '3d 5h'],
  ])('%d s: %s', (s, text) => expect(formatSpan(s)).toBe(text));

  it('latency', () => {
    expect([null, 17.5, 0].map(formatLatency)).toEqual(['--', '18 ms', '0 ms']);
    expect([null, 39.9, 40, 100].map(latencyColor)).toEqual(['var(--dim)', 'var(--text)', 'var(--warn)', 'var(--bad)']);
    expect(jitterText(NET)).toBe('Jitter 2.1 ms  •  Loss 3%');
  });

  it('live rates', () => expect(formatMbps(1835)).toBe('15.0'));
});

describe('texts', () => {
  it('status', () => {
    expect(statusText(NET, NOW)).toBe('Up 3d 5h  •  Last drop 3d ago, 45s');
    expect(statusText({ ...NET, online: false }, NOW)).toBe('Last drop 3d ago, 45s');
    expect(statusText({ ...NET, upSince: 0, lastDrop: null }, NOW)).toBe('No drops seen');
    expect(statusText({ ...NET, lastDrop: null, ip: '203.0.113.5' }, NOW)).toBe('Up 3d 5h  •  203.0.113.5');
  });

  it('Home', () => {
    expect(homeText(NET, NOW)).toBe('↓ 942  ↑ 38 Mbps  •  2h ago');
    expect(homeText({ ...NET, testing: true }, NOW)).toBe('Speed test running...');
    expect(homeText({ ...NET, speed: null }, NOW)).toBe('Jitter 2.1 ms  •  Loss 3%');
  });
});

describe('chart', () => {
  it('scales to the worst probe, at least 50 ms', () => {
    expect(chartPeak([])).toBe(50);
    expect(chartPeak([null, 12])).toBe(50);
    expect(chartPeak([12, 180, null])).toBe(180);
  });

  it('ends at the right edge, with gaps for lost probes', () => {
    expect(latencyPath([])).toBe('');
    expect(latencyPath([50, 25, null, 0, 10])).toBe('M55 0L56 50M58 100L59 80');
    expect(latencyPath(Array(60).fill(50))).toMatch(/^M0 0L.*L59 0$/);
  });
});

describe('speed test', () => {
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is locked for 2 minutes after a request, across a reload too', () => {
    const now = Date.now();
    new SpeedTestStore().requested();
    const reloaded = new SpeedTestStore().getState();
    expect(reloaded).toBe(now);
    expect(lockLeft(reloaded, now)).toBe(SPEED_TEST_LOCK_MS);
    expect(lockLeft(reloaded, now + SPEED_TEST_LOCK_MS - 1)).toBe(1);
    expect(lockLeft(reloaded, now + SPEED_TEST_LOCK_MS)).toBe(0);
  });

  it('is not locked at first, nor when the clock was set back', () => {
    expect(lockLeft(new SpeedTestStore().getState(), Date.now())).toBe(0);
    expect(lockLeft(Date.now() + 60_000, Date.now())).toBe(0);
    storage.set('deskhub-mobile.speedtest', '"x"');
    expect(new SpeedTestStore().getState()).toBe(0);
  });

  it('has a button that says what is going on', () => {
    const t = 1_800_000_000_000;
    const button = (testing: boolean, netAt: number, requestedAt: number, now: number, online = true) =>
      speedTestButton({ ...NET, testing }, netAt, requestedAt, now, online);
    expect(button(false, t, 0, t)).toEqual({ label: 'Run test', disabled: false });
    expect(button(false, t, 0, t, false)).toEqual({ label: 'Run test', disabled: true });
    expect(button(false, t - 500, t, t)).toEqual({ label: 'Starting...', disabled: true });
    expect(button(true, t + 100, t, t + 100)).toEqual({ label: 'Testing...', disabled: true });
    expect(button(false, t + 9000, t, t + 20_000)).toEqual({ label: 'Again in 1:40', disabled: true });
    expect(button(false, t + 9000, t, t + SPEED_TEST_LOCK_MS)).toEqual({ label: 'Run test', disabled: false });
    // Another phone's, or a scheduled one.
    expect(button(true, t, 0, t)).toEqual({ label: 'Testing...', disabled: true });
  });
});

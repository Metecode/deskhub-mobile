// The messages behind the AI page, alerts, the Internet view and the dark screen.
import { describe, expect, it } from 'vitest';
import { normalizeAlert } from './alert.js';
import { parseCommand } from './commands.js';
import { parseMessage, type RawMessage } from './companion.js';
import { applyLayout, DEFAULT_LAYOUT } from './layout.js';
import { normalizeNet } from './net.js';
import { normalizePcPower } from './power.js';
import { normalizeUsage } from './usage.js';

// As the functions named here return them at the pinned commit.
const AI = {
  // claude_usage.py, ClaudeUsage.snapshot(), with limits
  limits: { five_hour: { pct: 42.5, reset: 2000 }, seven_day: { pct: 81, reset: 9000 }, updated: 1000 },
  type: 'ai',
  provider: 'claude',
  today: { tokens: 1_200_000, output: 34_000, messages: 87 },
  block: { active: true, reset: 2000, tokens: 400_000, messages: 12 },
  last_hour: 90_000,
  days: [1, 2, 3, 4, 5, 6, 7],
  models: [
    { name: 'Opus 5', tokens: 900 },
    { name: 'Haiku 5', tokens: 100 },
  ],
};
const ALERT = {
  // claude_alerts.py
  type: 'alert',
  id: '0b9c6d8e-1f2a-4c3b-9d4e-5f6a7b8c9d0e',
  kind: 'permission',
  agent: 'claude',
  title: 'Claude wants to use Bash',
  detail: 'npm test',
  project: 'deskhub',
};
const NET = {
  // netstats.py, NetStats.message()
  type: 'net',
  online: true,
  latency_ms: 18.4,
  jitter_ms: 1.2,
  loss_pct: 2,
  hist: [18, -1, 20],
  up_since: 5000,
  last_drop: { at: 4000, dur_s: 12 },
  today_bytes: 1.5e9,
  month_bytes: 4.2e11,
  speed: { down_mbps: 94.1, up_mbps: 18.6, ping_ms: 17.5, at: 4500 },
  testing: false,
  ip: '',
};
const NET_AT_FIRST = {
  ...NET,
  online: false,
  latency_ms: null,
  jitter_ms: null,
  loss_pct: 0,
  hist: [],
  up_since: null,
  last_drop: null,
  speed: null,
};

describe('schemas', () => {
  it.each([
    AI,
    { ...AI, limits: {}, block: { active: false } },
    { ...AI, type: 'claude', provider: undefined },
    { ...AI, provider: 'codex', limits: { seven_day: { pct: 3, reset: 9000 }, updated: 1000 } },
    ALERT,
    { type: 'alert', clear: true },
    NET,
    NET_AT_FIRST,
    { type: 'pc_power', asleep: true },
  ])('know %j', (message) => {
    expect(parseMessage(message).kind).toBe('known');
  });

  it.each([
    { type: 'ai', days: 'many' },
    { type: 'alert', id: 7 },
    { type: 'net', hist: [true] },
    { type: 'pc_power', asleep: 'yes' },
  ])('do not fit %j', (message) => {
    expect(parseMessage(message).kind).toBe('mismatch');
  });
});

describe('normalizeUsage', () => {
  it('reads what the companion sends', () => {
    expect(normalizeUsage(AI)).toEqual({
      provider: 'claude',
      fiveHour: { pct: 42.5, reset: 2000 },
      sevenDay: { pct: 81, reset: 9000 },
      limitsUpdated: 1000,
      block: { reset: 2000, tokens: 400_000, messages: 12 },
      today: { tokens: 1_200_000, output: 34_000, messages: 87 },
      lastHour: 90_000,
      days: [1, 2, 3, 4, 5, 6, 7],
      models: AI.models,
    });
  });

  it('has no limits without a reading, and no block without an active one', () => {
    const usage = normalizeUsage({ ...AI, limits: {}, block: { active: false } });
    expect(usage).toMatchObject({ fiveHour: null, sevenDay: null, limitsUpdated: 0, block: null });
  });

  it('is of Claude when the provider is missing, as from older companions', () => {
    expect(normalizeUsage({ type: 'claude' }).provider).toBe('claude');
    expect(normalizeUsage({ type: 'ai', provider: 'codex' }).provider).toBe('codex');
  });

  it('falls back like the board', () => {
    expect(normalizeUsage({ type: 'ai', limits: 3, block: [], today: null, days: ['1', 2], models: [1] })).toEqual({
      provider: 'claude',
      fiveHour: null,
      sevenDay: null,
      limitsUpdated: 0,
      block: null,
      today: { tokens: 0, output: 0, messages: 0 },
      lastHour: 0,
      days: [0, 2, 0, 0, 0, 0, 0],
      models: [{ name: '', tokens: 0 }],
    });
  });

  it('takes 7 days and 4 models', () => {
    const usage = normalizeUsage({ ...AI, days: Array(9).fill(1), models: Array(6).fill({ name: 'x', tokens: 1 }) });
    expect(usage.days).toHaveLength(7);
    expect(usage.models).toHaveLength(4);
  });
});

describe('normalizeAlert', () => {
  it('reads an alert, and clear', () => {
    expect(normalizeAlert(ALERT)).toEqual({
      id: ALERT.id,
      permission: true,
      title: ALERT.title,
      detail: ALERT.detail,
      project: ALERT.project,
    });
    expect(normalizeAlert({ ...ALERT, kind: 'input' })?.permission).toBe(false);
    expect(normalizeAlert({ type: 'alert', clear: true })).toBeNull();
  });

  it.each(['a"b', 'ü{}', 'x'.repeat(80), 'a b/c'])('cleans the id %s into one that commands may have', (id) => {
    const alert = normalizeAlert({ ...ALERT, id })!;
    const command = { type: 'alert_action', id: alert.id, action: 'focus' };
    expect(parseCommand(JSON.stringify(command))).toEqual(command);
  });
});

describe('normalizeNet', () => {
  it('reads what the companion sends', () => {
    expect(normalizeNet(NET)).toEqual({
      online: true,
      latency: 18.4,
      jitter: 1.2,
      loss: 2,
      history: [18, null, 20],
      upSince: 5000,
      lastDrop: { at: 4000, seconds: 12 },
      todayBytes: 1.5e9,
      monthBytes: 4.2e11,
      speed: { down: 94.1, up: 18.6, ping: 17.5, at: 4500 },
      testing: false,
      ip: '',
    });
  });

  it('knows nothing at first', () => {
    expect(normalizeNet(NET_AT_FIRST)).toMatchObject({
      online: false,
      latency: null,
      jitter: 0,
      history: [],
      upSince: 0,
      lastDrop: null,
      speed: null,
    });
  });

  it('takes 60 probes, with anything but a number lost', () => {
    const { history } = normalizeNet({ type: 'net', hist: ['1', null, 2.9, 0, ...Array<number>(80).fill(3)] });
    expect(history).toHaveLength(60);
    expect(history.slice(0, 5)).toEqual([null, null, 2, 0, 3]);
  });
});

describe('normalizePcPower', () => {
  it('only takes true', () => {
    expect(normalizePcPower({ type: 'pc_power', asleep: true })).toBe(true);
    expect(normalizePcPower({ type: 'pc_power', asleep: 1 })).toBe(false);
    expect(normalizePcPower({ type: 'pc_power' })).toBe(false);
  });
});

describe('applyLayout', () => {
  const apply = (message: object, previous = DEFAULT_LAYOUT) =>
    applyLayout(previous, { type: 'layout', ...message } as RawMessage);

  it('is off while the PC sleeps and has no night until told otherwise', () => {
    expect(apply({})).toMatchObject({ pcSleep: 'off', night: { start: -1, end: -1, style: 'off' } });
  });

  it.each(['off', 'clock', 'none'] as const)('reads pc_sleep %s', (pc_sleep) => {
    expect(apply({ pc_sleep }).pcSleep).toBe(pc_sleep);
  });

  it('keeps pc_sleep on anything else', () => {
    const none = apply({ pc_sleep: 'none' });
    expect(apply({ pc_sleep: 'dim' }, none).pcSleep).toBe('none');
    expect(apply({}, none).pcSleep).toBe('none');
  });

  const night = apply({ night_start: 1380, night_end: 420, night_style: 'clock' });

  it('reads the night', () => {
    expect(night.night).toEqual({ start: 1380, end: 420, style: 'clock' });
    expect(apply({ night_start: -1, night_end: -1 }, night).night).toEqual({ start: -1, end: -1, style: 'off' });
  });

  it('keeps the night without night_start, and when a time is out of range', () => {
    expect(apply({ night_end: 5 }, night).night).toBe(night.night);
    expect(apply({ night_start: 1440, night_end: 5 }, night).night).toBe(night.night);
    expect(apply({ night_start: 5, night_end: -2 }, night).night).toBe(night.night);
  });
});

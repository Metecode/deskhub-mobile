import { normalizeUsage, type Usage } from '@deskhub-mobile/protocol';
import { describe, expect, it } from 'vitest';
import {
  agentColor,
  agentName,
  dayLabels,
  fiveHourView,
  formatAsOf,
  formatCountdown,
  formatTokens,
  homeLimits,
  isStale,
  levelColor,
  weeklyView,
} from './usage.js';

const at = (text: string) => new Date(text).getTime() / 1000;
const NOW = at('2026-11-20T15:05:00');
const FIVE = { pct: 37.6, reset: NOW + 2 * 3600 + 12 * 60 };
const WEEK = { pct: 80, reset: at('2026-11-23T14:01:00') };

const usage = (change: Partial<Usage> = {}): Usage => ({
  ...normalizeUsage({ type: 'ai' }),
  fiveHour: FIVE,
  sevenDay: WEEK,
  limitsUpdated: NOW - 60,
  ...change,
});
const BLOCK = { reset: NOW + 1800, tokens: 6_100_000, messages: 31 };
const OLD = NOW - 600;

describe('formats', () => {
  it.each([
    [0, '0'],
    [999.9, '999'],
    [1000, '1 B'],
    [182_000, '182 B'],
    [48_240_000, '48,2 Mn'],
    [1_250_000_000, '1,3 Mr'],
  ])('%d tokens: %s', (t, text) => expect(formatTokens(t)).toBe(text));

  it.each([
    [0, 'Şimdi sıfırlanıyor'],
    [-5, 'Şimdi sıfırlanıyor'],
    [1, '1 dk kaldı'],
    [61, '2 dk kaldı'],
    [3599, '60 dk kaldı'],
    [3600, '1 sa 0 dk kaldı'],
    [7920, '2 sa 12 dk kaldı'],
    [86_399, '23 sa 59 dk kaldı'],
  ])('%d s left: %s', (s, text) => expect(formatCountdown(NOW + s, NOW)).toBe(text));

  it('a reset in more than a day by its time', () => {
    expect(formatCountdown(WEEK.reset, NOW)).toBe('Pzt 14:01');
  });

  it('old readings', () => {
    expect(isStale(NOW - 599, NOW)).toBe(false);
    expect(isStale(NOW - 600, NOW)).toBe(true);
    expect(isStale(0, NOW)).toBe(false);
    expect(formatAsOf(at('2026-11-20T09:30:00'), NOW)).toBe('09:30 itibarıyla');
    expect(formatAsOf(at('2026-11-18T09:30:00'), NOW)).toBe('Çar itibarıyla');
  });

  it('colours by level', () => {
    expect([49.9, 50, 79.9, 80].map(levelColor)).toEqual(['var(--good)', 'var(--warn)', 'var(--warn)', 'var(--bad)']);
  });

  it('the agent', () => {
    const codex = usage({ provider: 'codex' });
    expect([agentName(null), agentName(usage()), agentName(codex)]).toEqual(['Claude Code', 'Claude Code', 'Codex']);
    expect(agentColor(codex)).not.toBe(agentColor(null));
  });

  it('the days', () => {
    expect(dayLabels(7, NOW)).toEqual(['Cmt', 'Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Bugün']);
  });
});

describe('5-hour card', () => {
  const view = (change: Partial<Usage>) => fiveHourView(usage(change), NOW);

  it('counts down', () => {
    expect(view({})).toEqual({ pct: 37.6, big: '', reset: '2 sa 12 dk kaldı', sub: '' });
  });

  it('says how old an old reading is', () => {
    expect(view({ limitsUpdated: OLD })).toMatchObject({ pct: 37.6, sub: formatAsOf(OLD, NOW) });
  });

  it('is fresh when only the weekly window is left of a recent reading', () => {
    expect(view({ fiveHour: null })).toEqual({ pct: 0, big: '', reset: 'İlk mesajla başlar', sub: '' });
  });

  it('shows the estimate when that reading is old, or there is none', () => {
    const estimate = { pct: null, big: '6,1 Mn', reset: '30 dk kaldı', sub: 'token, 31 mesaj (tahmini)' };
    expect(view({ fiveHour: null, limitsUpdated: OLD, block: BLOCK })).toEqual(estimate);
    expect(view({ fiveHour: null, sevenDay: null, limitsUpdated: 0, block: BLOCK })).toEqual(estimate);
  });

  it('is idle without an estimate', () => {
    expect(view({ fiveHour: null, sevenDay: null })).toEqual({ pct: null, big: 'Boşta', reset: '', sub: 'Açık pencere yok' });
  });

  it('is missing on some Codex plans', () => {
    expect(view({ provider: 'codex', fiveHour: null })).toEqual({
      pct: null,
      big: '--',
      reset: '',
      sub: 'Bu planda 5 saatlik limit yok',
    });
    expect(view({ provider: 'codex' }).pct).toBe(37.6);
  });

  it('is empty before the first message', () => {
    expect(fiveHourView(null, NOW)).toEqual({ pct: null, big: '--', reset: '', sub: '' });
  });
});

describe('weekly card', () => {
  it('has a limit, an age, or a hint', () => {
    expect(weeklyView(usage(), NOW)).toMatchObject({ pct: 80, sub: '' });
    expect(weeklyView(usage({ limitsUpdated: OLD }), NOW).sub).toBe(formatAsOf(OLD, NOW));
    expect(weeklyView(usage({ sevenDay: null }), NOW)).toEqual({
      pct: null,
      big: '--',
      reset: 'Henüz limit bilgisi yok',
      sub: 'Claude Code yanıtından sonra görünür',
    });
    expect(weeklyView(usage({ sevenDay: null, provider: 'codex' }), NOW).sub).toBe('Codex yanıtından sonra görünür');
    expect(weeklyView(null, NOW)).toEqual({ pct: null, big: '--', reset: '', sub: '' });
  });
});

describe('Home card', () => {
  const home = (change: Partial<Usage> | null, online = true) =>
    homeLimits(change && usage(change), online, NOW).map(({ pct, sub }) => [pct, sub]);

  it('counts down, or says how old the reading is', () => {
    expect(home({})).toEqual([
      [37.6, '2 sa 12 dk kaldı'],
      [80, formatCountdown(WEEK.reset, NOW)],
    ]);
    expect(home({ limitsUpdated: OLD })).toEqual([
      [37.6, formatAsOf(OLD, NOW)],
      [80, formatAsOf(OLD, NOW)],
    ]);
  });

  it('has no data', () => {
    expect(home(null)[0]).toEqual([null, 'PC bekleniyor']);
    expect(home(null, false)[0]).toEqual([null, 'PC çevrimdışı']);
    expect(home({ fiveHour: null, sevenDay: null })).toEqual([
      [null, 'Henüz veri yok'],
      [null, 'Henüz veri yok'],
    ]);
  });

  it('has only the weekly limit', () => {
    expect(home({ fiveHour: null })[0]).toEqual([0, 'Yeni pencere hazır']);
    expect(home({ fiveHour: null, limitsUpdated: OLD })[0]).toEqual([null, formatAsOf(OLD, NOW)]);
    expect(home({ fiveHour: null, provider: 'codex' })[0]).toEqual([null, '5 saatlik limit yok']);
  });

  it('keeps the limits while the PC is offline, as the board does', () => {
    expect(home({}, false)[0]).toEqual([37.6, '2 sa 12 dk kaldı']);
  });
});

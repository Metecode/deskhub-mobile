import type { BulletinMessage, CalendarEvent, TodayReminder } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bulletinBadge, firstEventToday, morningReading, MorningStore, showMorning } from './morning.js';
import type { Weather } from './weather.js';

const NOW = new Date(2026, 10, 30, 8, 0).getTime();
const now = NOW / 1000;
const ready = (date = '2026-11-30'): BulletinMessage => ({
  type: 'bridge.bulletin',
  state: 'ready',
  date,
  markdown: '## 0. Bir bakışta\n- Fed tutanakları bu akşam.\n\n**Somut adım: Bugün işlem gerekmiyor.**',
});
const none = { closed: null, opened: null, read: null };

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('showMorning', () => {
  it('shows once a day from 05:00, when the bulletin is set up', () => {
    expect(showMorning(ready(), none, NOW)).toBe(true);
    expect(showMorning({ type: 'bridge.bulletin', state: 'running' }, none, NOW)).toBe(true);
    expect(showMorning(ready(), { ...none, closed: '2026-11-30' }, NOW)).toBe(false);
    expect(showMorning(ready(), none, new Date(2026, 10, 30, 4, 59).getTime())).toBe(false);
    expect(showMorning({ type: 'bridge.bulletin', state: 'off' }, none, NOW)).toBe(false);
    expect(showMorning(null, none, NOW)).toBe(false);
  });

  it('remembers being closed, and opening the bulletin closes it too', () => {
    const store = new MorningStore();
    store.open(NOW);
    expect(new MorningStore().getState()).toEqual({ closed: '2026-11-30', opened: '2026-11-30', read: null });
  });
});

describe('bulletinBadge', () => {
  it("is there until today's is opened", () => {
    expect(bulletinBadge(ready(), none, NOW)).toBe(true);
    expect(bulletinBadge(ready('2026-11-29'), none, NOW)).toBe(false);
    expect(bulletinBadge(ready(), { ...none, opened: '2026-11-30' }, NOW)).toBe(false);
  });
});

const event = (h: number, title: string, allDay = false): CalendarEvent => {
  const start = new Date(2026, 10, 30, h).getTime() / 1000;
  return { start, end: start + 3600, allDay, color: '#fff', title, location: '', calendar: '' };
};

describe('morningReading', () => {
  const weather = { temp: 9, code: 2, days: [{ hi: 13, lo: 4 }] } as unknown as Weather;
  const reminder = { id: 'olcum', title: 'Kilo ve bel ölçümü', done: false } as TodayReminder;

  it('reads the weather, the first event, the reminder, then the bulletin', () => {
    const { sentences } = morningReading({ weather, events: [event(10, 'Sprint planlama')], reminders: [reminder], bulletin: ready(), now });
    expect(sentences.slice(0, 4)).toEqual([
      'Günaydın.',
      expect.stringMatching(/^Hava 9°, .+, en yüksek 13°\.$/),
      'İlk etkinlik saat 10:00, Sprint planlama.',
      'Bugün: Kilo ve bel ölçümü.',
    ]);
    expect(sentences).toContain('Sabah bülteni.');
    expect(sentences.at(-1)).toBe('Bugün işlem gerekmiyor.');
  });

  it("says there is no event, and leaves out yesterday's bulletin", () => {
    const { sentences } = morningReading({ weather: null, events: [], reminders: [], bulletin: ready('2026-11-29'), now });
    expect(sentences).toEqual(['Günaydın.', 'Bugün etkinlik yok.']);
  });

  it('takes the first event of today only', () => {
    const tomorrow = { ...event(9, 'Yarın'), start: now + 86400 * 2, end: now + 86400 * 2 + 60 };
    expect(firstEventToday([tomorrow], now)).toBeNull();
    expect(firstEventToday([event(7, 'Bitti'), event(12, 'Öğle')], now)?.title).toBe('Öğle');
  });
});

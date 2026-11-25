import { normalizeEvents } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsStore } from './eventsStore.js';

const KEY = 'deskhub-mobile.events';
const DAY = 86_400;
const NOW = 1_800_000_000;
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

const event = (title: string, start: number, end: number, all_day = false) => ({
  title,
  start,
  end,
  all_day,
  color: '#112233',
  loc: 'Room',
  cal: 'Work',
});
const message = (events: unknown[], days = 7) => normalizeEvents({ type: 'events', events, days });
const titles = (now: number) => new EventsStore().load(now).events.map((e) => e.title);

describe('EventsStore', () => {
  it('brings everything of an event back', () => {
    const events = message([event('A', NOW + 10, NOW + 20), event('B', NOW, NOW + DAY, true)], 3);
    new EventsStore().update(events, NOW);
    expect(new EventsStore().load(NOW)).toEqual(events);
  });

  it('keeps nothing when there was nothing', () => {
    expect(new EventsStore().load(NOW)).toEqual({ events: [], days: 7 });
    expect(storage.size).toBe(0);
  });

  it('only keeps the days the companion looked ahead, from when the events came', () => {
    new EventsStore().update(message([event('in', NOW + 2 * DAY - 1, NOW + 3 * DAY), event('out', NOW + 2 * DAY, NOW + 3 * DAY)], 2), NOW);
    expect(storage.get(KEY)).not.toContain('out');
    expect(titles(NOW)).toEqual(['in']);
    // A later look doesn't move the range.
    expect(titles(NOW + DAY)).toEqual(['in']);
  });

  it('takes what is over out of the storage when it is read', () => {
    new EventsStore().update(message([event('over', NOW, NOW + 60), event('next', NOW + 100, NOW + 200)]), NOW);
    expect(titles(NOW + 60)).toEqual(['next']);
    expect(storage.get(KEY)).not.toContain('over');
    expect(titles(NOW + 200)).toEqual([]);
    expect(storage.size).toBe(0);
  });

  it('takes it out while the page is open', () => {
    const store = new EventsStore();
    store.update(message([event('over', NOW, NOW + 60), event('next', NOW + 100, NOW + 200)]), NOW);
    store.clean(NOW + 59);
    expect(storage.get(KEY)).toContain('over');
    store.clean(NOW + 60);
    expect(storage.get(KEY)).not.toContain('over');
    expect(storage.get(KEY)).toContain('next');
    store.clean(NOW + 200);
    expect(storage.size).toBe(0);
  });

  it('also cleans what it loaded', () => {
    new EventsStore().update(message([event('A', NOW, NOW + 60)]), NOW);
    const store = new EventsStore();
    store.load(NOW + 1);
    store.clean(NOW + 60);
    expect(storage.size).toBe(0);
  });

  it('forgets everything when the calendar is empty', () => {
    const store = new EventsStore();
    store.update(message([event('A', NOW, NOW + 60)]), NOW);
    store.update(message([]), NOW);
    expect(storage.size).toBe(0);
  });

  it('writes only when something changed', () => {
    const store = new EventsStore();
    store.update(message([event('A', NOW, NOW + 60)]), NOW);
    storage.clear();
    store.clean(NOW + 1);
    expect(storage.size).toBe(0);
  });

  it.each(['', 'null', '5', '[]', '{"events":5}', '{"events":[null,5,{}]}', '{"at":"x","events":[{"end":"soon"}]}', '{'])(
    'survives %j in the storage',
    (text) => {
      storage.set(KEY, text);
      expect(new EventsStore().load(NOW).events).toEqual([]);
    },
  );

  it('survives a blocked storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const store = new EventsStore();
    expect(store.load(NOW).events).toEqual([]);
    expect(() => store.update(message([event('A', NOW, NOW + 60)]), NOW)).not.toThrow();
  });
});

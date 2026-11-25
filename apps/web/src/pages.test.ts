// What the pages show, apart from their markup.
import { DEFAULT_HOME, DEFAULT_LAYOUT, NO_MEDIA, type CalendarEvent, type Media } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agenda, calendarBadge, eventsSummary, eventWhen, isLive, untilText } from './agenda.js';
import { coverOf, readCover, rgb565ToRgba } from './cover.js';
import { glyph, tileIcon } from './icons.js';
import { loadLayout, saveLayout } from './layoutStore.js';
import { tabsOf } from './nav.js';
import { positionAt } from './position.js';
import { formatClock, formatDate, formatDuration, formatHour, formatShortDate, startOfDay } from './time.js';
import { formatPrecip, formatTemp, isDaytime, weatherColor, weatherIcon, weatherText } from './weatherLook.js';

/** Local time, epoch seconds. 2026-11-20 is a Friday. */
const at = (day: number, hour = 0, minute = 0) => new Date(2026, 10, day, hour, minute).getTime() / 1000;

describe('time', () => {
  it('has 24 hours', () => {
    expect(formatClock(at(20, 15, 5))).toBe('15:05');
    expect(formatClock(at(20, 0, 0))).toBe('00:00');
    expect(formatHour(at(20, 9))).toBe('09:00');
  });

  it('has dates in Turkish', () => {
    expect(formatDate(at(20))).toBe('20 Kasım Cuma');
    expect(formatShortDate(at(20))).toBe('20 Kas Cum');
  });

  it('knows days', () => {
    expect(startOfDay(at(20, 23, 59))).toBe(at(20));
    expect(startOfDay(at(30, 12), 1)).toBe(new Date(2026, 11, 1).getTime() / 1000);
  });

  it('has durations', () => {
    expect([0, 59, 187, 3729, -5, 61.9].map(formatDuration)).toEqual(['0:00', '0:59', '3:07', '1:02:09', '0:00', '1:01']);
  });
});

describe('calendar', () => {
  const event = (start: number, end: number, more: Partial<CalendarEvent> = {}): CalendarEvent => ({
    start,
    end,
    allDay: false,
    color: '#123456',
    title: '',
    location: '',
    calendar: '',
    ...more,
  });
  const now = at(20, 12);

  it('groups by day, without what is over', () => {
    const events = [
      event(at(20, 8), at(20, 9), { title: 'over' }),
      event(at(20, 11), at(20, 13), { title: 'running' }),
      event(at(20, 23), at(21, 1), { title: 'late' }),
      event(at(21, 0), at(21, 1), { title: 'midnight' }),
      event(at(23, 9), at(23, 10), { title: 'monday' }),
    ];
    expect(agenda(events, now).map((d) => [d.title, d.events.map((e) => e.title)])).toEqual([
      ['Bugün, 20 Kasım Cuma', ['running', 'late']],
      ['Yarın, 21 Kasım Cumartesi', ['midnight']],
      ['23 Kasım Pazartesi', ['monday']],
    ]);
  });

  it('lists an event from an earlier day under today, and drops it when it ends', () => {
    const trip = event(at(18), at(21), { allDay: true, title: 'trip' });
    expect(agenda([trip], now)[0]).toMatchObject({ day: at(20), events: [trip] });
    expect(agenda([trip], at(21))).toEqual([]);
  });

  it('marks timed events in progress', () => {
    expect(isLive(event(now, now + 60), now)).toBe(true);
    expect(isLive(event(now + 1, now + 60), now)).toBe(false);
    expect(isLive(event(now - 60, now), now)).toBe(false);
    expect(isLive(event(at(20), at(21), { allDay: true }), now)).toBe(false);
  });

  it('says when an event is', () => {
    expect(eventWhen(event(at(20, 15, 30), at(20, 16)), now)).toBe('Bugün, 15:30');
    expect(eventWhen(event(at(21, 9), at(21, 10)), now)).toBe('Yarın, 09:00');
    expect(eventWhen(event(at(23, 9), at(23, 10)), now)).toBe('23 Kas Pzt, 09:00');
    expect(eventWhen(event(at(20, 11), at(20, 13)), now)).toBe('Şimdi, bitiş 13:00');
    expect(eventWhen(event(at(20), at(21), { allDay: true }), now)).toBe('Bugün, Tüm gün');
  });

  it('says in the panel how long it takes', () => {
    expect(untilText(event(at(20, 12, 48), at(20, 13)), now)).toBe('12:48, 48 dk sonra');
    expect(untilText(event(at(20, 13), at(20, 14)), now)).toBe('13:00, 1 sa sonra');
    expect(untilText(event(at(20, 14, 5), at(20, 15)), now)).toBe('14:05, 2 sa 5 dk sonra');
    expect(untilText(event(now + 1, at(20, 15)), now)).toBe('12:00, 1 dk sonra');
    expect(untilText(event(at(20, 11), at(20, 13)), now)).toBe('Bitiş 13:00');
    expect(untilText(event(at(19, 11), at(20, 13)), now)).toBe('Bitiş 13:00');
    expect(untilText(event(at(20), at(21), { allDay: true }), now)).toBe('Bugün, Tüm gün');
    expect(untilText(event(at(21, 9), at(21, 10)), now)).toBe('Yarın, 09:00');
  });

  it('knows tomorrow across the year', () => {
    const eve = new Date(2026, 11, 31, 20).getTime() / 1000;
    expect(eventWhen(event(eve + 6 * 3600, eve + 7 * 3600), eve)).toBe('Yarın, 02:00');
  });

  it('closes the list', () => {
    const events = [event(now - 9, now - 1), event(now, now + 1), event(now, now + 2)];
    expect(eventsSummary({ events, days: 7 }, now, 2)).toBe('Önümüzdeki 7 günde başka etkinlik yok');
    expect(eventsSummary({ events, days: 7 }, now, 1)).toBe('Önümüzdeki 7 günde 1 etkinlik daha');
    expect(eventsSummary({ events: [], days: 1 }, now, 0)).toBe('Önümüzdeki 1 günde etkinlik yok');
  });

  it('has a dot while the next event is today', () => {
    expect(calendarBadge([event(now - 9, now - 1), event(at(20, 23), at(20, 23, 30))], now)).toBe('#123456');
    expect(calendarBadge([event(at(21), at(21, 1))], now)).toBeNull();
    expect(calendarBadge([], now)).toBeNull();
  });
});

describe('media', () => {
  const playing: Media = { ...NO_MEDIA, active: true, playing: true, pos: 10, dur: 60, artId: 7 };

  it('advances by itself', () => {
    expect(positionAt(playing, 1000, 1999)).toBe(10);
    expect(positionAt(playing, 1000, 4000)).toBe(13);
    expect(positionAt(playing, 1000, 999_000)).toBe(60);
    expect(positionAt(playing, 4000, 1000)).toBe(10);
  });

  it('does not while paused, or without a length', () => {
    expect(positionAt({ ...playing, playing: false }, 0, 5000)).toBe(10);
    expect(positionAt({ ...playing, dur: 0 }, 0, 5000)).toBe(10);
    expect(positionAt({ ...playing, pos: 80 }, 0, 5000)).toBe(80);
  });

  const frame = (magic: string, id: number, w: number, h: number) => {
    const data = new Uint8Array(12 + w * h * 2);
    data.set([...magic].map((c) => c.charCodeAt(0)));
    const view = new DataView(data.buffer);
    view.setUint32(4, id, true);
    view.setUint16(8, w, true);
    view.setUint16(10, h, true);
    return data.buffer;
  };

  it('reads covers', () => {
    expect(readCover(frame('ART1', 7, 2, 1))).toMatchObject({ art: { magic: 'ART1' }, cover: { id: 7, width: 2, height: 1 } });
    expect(readCover(frame('ARS1', 8, 320, 320))).toMatchObject({ art: { magic: 'ARS1' }, cover: { id: 8 } });
    for (const bad of [frame('ART1', 7, 321, 1), frame('ARS1', 7, 1, 321), frame('XXX1', 7, 1, 1), new ArrayBuffer(3)])
      expect(readCover(bad)).toBeNull();
  });

  it('converts RGB565', () => {
    const pixels = [0x0000, 0xffff, 0xf800, 0x07e0, 0x001f, 0x8410];
    const data = new Uint8Array(new Uint16Array(pixels).buffer);
    expect([...rgb565ToRgba(data)]).toEqual(
      [[0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [132, 130, 132]].flatMap((c) => [...c, 255]),
    );
  });

  it('only shows the cover of what plays', () => {
    const { cover } = readCover(frame('ART1', 7, 1, 1))!;
    expect(coverOf(playing, cover)).toBe(cover);
    expect(coverOf({ ...playing, artId: 8 }, cover)).toBeNull();
    expect(coverOf({ ...playing, active: false }, cover)).toBeNull();
    expect(coverOf({ ...playing, artId: 0 }, { ...cover, id: 0 })).toBeNull();
    expect(coverOf(playing, null)).toBeNull();
  });
});

describe('weather look', () => {
  it('has the icons, colours and texts of weather.c', () => {
    expect([0, 1, 2, 3, 45, 51, 61, 71, 80, 86, 95, 10].map((c) => weatherIcon(c, true))).toEqual([
      'wb_sunny',
      'wb_cloudy',
      'wb_cloudy',
      'cloud',
      'foggy',
      'grain',
      'umbrella',
      'ac_unit',
      'umbrella',
      'ac_unit',
      'thunderstorm',
      'cloud',
    ]);
    expect([0, 2, 3].map((c) => weatherIcon(c, false))).toEqual(['nights_stay', 'nights_stay', 'cloud']);
    expect(weatherColor(0, true)).toBe('#fbbf5a');
    expect(weatherColor(2, false)).toBe('#a9b4ff');
    expect(weatherColor(63, true)).toBe('#67e8f9');
    expect([2, 65, 99, 42].map(weatherText)).toEqual(['Parçalı bulutlu', 'Şiddetli yağmur', 'Dolulu fırtına', 'Bilinmiyor']);
  });

  it('rounds temperatures', () => {
    expect([12.4, 12.5, -0.4, -0.5, -1.6].map(formatTemp)).toEqual(['12°', '13°', '0°', '-1°', '-2°']);
  });

  it('leaves out little chance of rain', () => {
    expect([0, 9, 10, 80].map(formatPrecip)).toEqual(['', '', '%10', '%80']);
  });

  it('takes 6 to 19 as day', () => {
    expect([5, 6, 18, 19].map((h) => isDaytime(at(20, h)))).toEqual([false, true, true, false]);
  });
});

describe('icons', () => {
  it('falls back to apps', () => {
    expect(tileIcon('mic_off')).toBe('mic_off');
    for (const name of ['teapot', '', 'constructor', '__proto__', 'wifi_off']) expect(tileIcon(name), name).toBe('apps');
    expect(glyph('apps')).toBe('');
  });
});

describe('navigation', () => {
  it('has tabs for the pages there are, in the companion order', () => {
    expect(tabsOf(DEFAULT_LAYOUT.pages)).toEqual([
      'home',
      'stats',
      'ai',
      'calendar',
      'weather',
      'media',
      'timer',
      'games',
      'shortcuts',
    ]);
    expect(tabsOf(['home', 'media', 'ai', 'stats', 'network', 'github'])).toEqual(['home', 'media', 'ai', 'stats', 'github']);
  });
});

describe('saved layout', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts with the defaults, the bar on the left', () => {
    expect(loadLayout()).toEqual({ layout: DEFAULT_LAYOUT, home: DEFAULT_HOME });
    expect(loadLayout().layout.nav).toBe('left');
  });

  it('comes back', () => {
    const saved = {
      layout: {
        pages: ['home', 'media', 'stats'],
        nav: 'bottom',
        pcSleep: 'clock',
        night: { start: 1380, end: 420, style: 'clock' },
      },
      home: { header: false, grid: [{ widget: 'clock', x: 1, y: 0, w: 3, h: 2 }] },
    } as const;
    saveLayout(saved);
    expect(loadLayout()).toEqual(saved);
  });

  it.each(['nope', '5', '{}', '{"layout":1,"home":"x"}'])('survives %j', (text) => {
    storage.set('deskhub-mobile.layout', text);
    expect(loadLayout()).toEqual({ layout: DEFAULT_LAYOUT, home: DEFAULT_HOME });
  });

  it('survives blocked storage', () => {
    vi.stubGlobal('localStorage', undefined);
    saveLayout({ layout: DEFAULT_LAYOUT, home: DEFAULT_HOME });
    expect(loadLayout().layout).toEqual(DEFAULT_LAYOUT);
  });
});

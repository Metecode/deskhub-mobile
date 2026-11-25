// The messages behind Home, Media, Calendar and Shortcuts.
import { describe, expect, it } from 'vitest';
import { parseMessage, type RawMessage } from './companion.js';
import { normalizeEvents } from './events.js';
import { columnsToGrid, DEFAULT_HOME, normalizeHome, visibleWidgets } from './home.js';
import { applyLayout, DEFAULT_LAYOUT } from './layout.js';
import { NO_MEDIA, normalizeMedia, normalizeMediaServer } from './media.js';
import { normalizeTiles, normalizeTileState } from './tiles.js';

// What the functions named here return at the pinned commit.
const MEDIA = {
  // media.py, Media.snapshot()
  type: 'media',
  active: true,
  playing: false,
  title: 'Midnight City Lights',
  artist: 'Synth Dreams',
  album: 'Neon Skyline',
  source: 'Spotify',
  pos: 75,
  dur: 241,
  can_seek: true,
  art_id: 1435727636,
};
const LAYOUT = {
  // pages.py, layout_message({})
  type: 'layout',
  pages: ['home', 'stats', 'ai', 'calendar', 'weather', 'media', 'timer', 'network', 'shortcuts'],
  ordered: true,
  nav: 'left',
  pc_sleep: 'off',
  night_start: -1,
  night_end: -1,
  night_style: 'off',
};
const HOME = {
  // pages.py, home_message({})
  type: 'home',
  left: ['claude', 'events'],
  right: ['weather', 'media', 'stats'],
  header: true,
  grid: [
    { widget: 'claude', x: 0, y: 0, w: 3, h: 1 },
    { widget: 'events', x: 0, y: 1, w: 3, h: 2 },
    { widget: 'weather', x: 3, y: 0, w: 2, h: 1 },
    { widget: 'media', x: 3, y: 1, w: 2, h: 1 },
    { widget: 'stats', x: 3, y: 2, w: 2, h: 1 },
  ],
};
const SERVER = {
  type: 'media_server',
  configured: true,
  online: true,
  streams: 2,
  transcoding: 1,
  name: 'Beans',
  kind: 'plex',
  version: 'Plex Media Server 1.41.2',
  library: '312 movies, 45 shows',
  active: true,
  playing: true,
  title: 'A Film',
  artist: '2019',
  album: 'alex on TV',
  source: 'Beans - transcoding',
  pos: 10,
  dur: 5400,
  can_seek: false,
  controls: false,
  art_id: 9,
};
const EVENT = { title: 'Review', loc: 'Room 2', cal: 'Work', start: 1000, end: 2000, all_day: false, color: '#f5a524' };
const EVENTS = { type: 'events', events: [EVENT], days: 7 };
const TILES = { type: 'tiles', tiles: [{ label: 'Mute mic', icon: 'mic_off', color: '#b4413c' }] };

describe('schemas', () => {
  it.each([
    MEDIA,
    { type: 'media', active: false },
    SERVER,
    { type: 'media_server', configured: false },
    EVENTS,
    { type: 'events', events: [], days: 7 },
    TILES,
    { type: 'tile_state', on: [0, 3] },
    LAYOUT,
    HOME,
  ])('fit what the companion sends: $type', (message) => {
    expect(parseMessage(message)).toEqual({ kind: 'known', type: message.type, message, raw: message });
  });

  it.each(['media', 'media_server', 'events', 'tiles', 'tile_state', 'layout', 'home'])(
    'need no fields and keep unknown ones: %s',
    (type) => {
      expect(parseMessage({ type, later: 1 })).toMatchObject({ kind: 'known', message: { later: 1 } });
    },
  );

  it('report a mismatch and keep the message', () => {
    const raw = { type: 'events', events: 'none' };
    expect(parseMessage(raw)).toMatchObject({ kind: 'mismatch', raw });
  });
});

describe('normalizeMedia', () => {
  it('reads what the companion sends', () => {
    expect(normalizeMedia(MEDIA)).toEqual({
      active: true,
      playing: false,
      canSeek: true,
      controls: true,
      pos: 75,
      dur: 241,
      artId: 1435727636,
      title: 'Midnight City Lights',
      artist: 'Synth Dreams',
      album: 'Neon Skyline',
      source: 'Spotify',
    });
    expect(normalizeMedia({ type: 'media', active: false })).toEqual(NO_MEDIA);
  });

  it('has controls unless they are false', () => {
    expect(normalizeMedia({ type: 'media', controls: null }).controls).toBe(true);
    expect(normalizeMedia({ type: 'media', controls: false }).controls).toBe(false);
  });

  it('falls back on mistyped fields', () => {
    const raw = { type: 'media', active: 1, pos: '5', dur: 9.9, title: 3, art_id: null };
    expect(normalizeMedia(raw)).toEqual({ ...NO_MEDIA, dur: 9 });
  });

  it('keeps letters and length', () => {
    const title = 'Işıklı Yağmur '.repeat(20);
    expect(normalizeMedia({ type: 'media', title }).title).toBe(title);
  });
});

describe('normalizeMediaServer', () => {
  it('has the server and what it plays', () => {
    expect(normalizeMediaServer(SERVER)).toMatchObject({
      configured: true,
      online: true,
      transcoding: 1,
      name: 'Beans',
      kind: 'plex',
      library: '312 movies, 45 shows',
      now: { active: true, controls: false, title: 'A Film', artId: 9 },
    });
    expect(normalizeMediaServer({ type: 'media_server', configured: false })).toMatchObject({
      configured: false,
      now: NO_MEDIA,
    });
  });
});

describe('normalizeEvents', () => {
  it('reads an event', () => {
    expect(normalizeEvents(EVENTS)).toEqual({
      days: 7,
      events: [
        { title: 'Review', location: 'Room 2', calendar: 'Work', start: 1000, end: 2000, allDay: false, color: '#f5a524' },
      ],
    });
  });

  it('sorts by start, all-day first', () => {
    const at = (title: string, start: number, all_day = false) => ({ title, start, all_day });
    const raw = { type: 'events', events: [at('c', 20), at('b', 10), at('a', 10, true)] };
    expect(normalizeEvents(raw).events.map((e) => e.title)).toEqual(['a', 'b', 'c']);
  });

  it.each([0, -1, null, 'x', undefined])('takes days %j as 7', (days) => {
    expect(normalizeEvents({ type: 'events', days }).days).toBe(7);
  });

  it('takes 16 at most, and anything in the list', () => {
    expect(normalizeEvents({ type: 'events', events: Array(20).fill(EVENT) }).events).toHaveLength(16);
    expect(normalizeEvents({ type: 'events', events: [null] }).events[0]).toMatchObject({ title: '', color: '#7c9cff' });
    expect(normalizeEvents({ type: 'events', events: {} }).events).toEqual([]);
  });

  it.each([
    ['#F5A524', '#f5a524'],
    ['#12', '#000012'],
    ['#zz', '#000000'],
    ['#ff0000;background:url(x)', '#ff0000'],
    ['red', '#7c9cff'],
    [5, '#7c9cff'],
  ])('reads the colour %j as %s', (color, expected) => {
    expect(normalizeEvents({ type: 'events', events: [{ color }] }).events[0]?.color).toBe(expected);
  });
});

describe('tiles', () => {
  it('reads how they look', () => {
    expect(normalizeTiles(TILES)).toEqual([{ label: 'Mute mic', icon: 'mic_off', color: '#b4413c' }]);
    expect(normalizeTiles({ type: 'tiles', tiles: [{}] })).toEqual([{ label: '', icon: '', color: '#2a2f3a' }]);
    expect(normalizeTiles({ type: 'tiles', tiles: Array(20).fill({}) })).toHaveLength(16);
  });

  it('knows which are on', () => {
    const raw = { type: 'tile_state', on: [0, 3, 16, -1, '2', null] };
    expect([...normalizeTileState(raw)]).toEqual([0, 3]);
    expect(normalizeTileState({ type: 'tile_state' }).size).toBe(0);
  });
});

describe('layout', () => {
  it('starts with the board defaults and the bar on the left', () => {
    expect(DEFAULT_LAYOUT).toEqual({
      pages: ['home', 'stats', 'ai', 'calendar', 'weather', 'media', 'timer', 'games', 'network', 'shortcuts'],
      nav: 'left',
    });
  });

  it('takes the pages in the order sent', () => {
    expect(applyLayout(DEFAULT_LAYOUT, LAYOUT)).toEqual({ pages: LAYOUT.pages, nav: 'left' });
    const raw = { type: 'layout', ordered: true, nav: 'bottom', pages: ['media', 'media', 'x', 4, 'weather'] };
    expect(applyLayout(DEFAULT_LAYOUT, raw)).toEqual({ pages: ['home', 'media', 'weather'], nav: 'bottom' });
  });

  it('keeps the order when the companion is too old to have one', () => {
    const previous = { pages: ['home', 'weather', 'stats'], nav: 'right' } as const;
    const raw = { type: 'layout', pages: ['stats', 'weather', 'shortcuts', 'media'] };
    expect(applyLayout(previous, raw)).toEqual({
      pages: ['home', 'weather', 'stats', 'media', 'shortcuts'],
      nav: 'right',
    });
  });

  it.each([undefined, null, '', 'top'])('keeps the bar where it is for nav %j', (nav) => {
    const right = { ...DEFAULT_LAYOUT, nav: 'right' } as const;
    expect(applyLayout(right, { type: 'layout', nav }).nav).toBe('right');
  });

  it('always has Home', () => {
    expect(applyLayout(DEFAULT_LAYOUT, { type: 'layout', ordered: true }).pages).toEqual(['home']);
  });
});

describe('home', () => {
  it('reads the grid', () => {
    expect(normalizeHome(HOME)).toEqual({ header: true, grid: HOME.grid });
    expect(DEFAULT_HOME).toEqual({ header: true, grid: HOME.grid });
  });

  it('clamps and drops like the board', () => {
    const grid = [
      { widget: 'stats', x: -2, y: -1, w: 2, h: 1 },
      { widget: 'events', x: 3, y: 2, w: 5, h: 3 },
      { widget: 'stats', x: 0, y: 0, w: 1, h: 1 },
      { widget: 'clock', x: 5, y: 0, w: 1, h: 1 },
      { widget: 'media', x: 0, y: 0, w: 0, h: 1 },
      { widget: 'rocket', x: 0, y: 0, w: 1, h: 1 },
      { widget: 'weather' },
      null,
    ];
    expect(normalizeHome({ type: 'home', grid })).toEqual({
      header: false,
      grid: [
        { widget: 'stats', x: 0, y: 0, w: 2, h: 1 },
        { widget: 'events', x: 3, y: 2, w: 2, h: 1 },
        { widget: 'weather', x: 0, y: 0, w: 1, h: 1 },
      ],
    });
  });

  it('may be empty', () => {
    expect(normalizeHome({ type: 'home', grid: [] }).grid).toEqual([]);
  });

  // Expected values from columns_to_grid() itself.
  it('converts the columns of older companions', () => {
    expect(columnsToGrid(['clock', 'events', 'claude'], ['github', 'weather', 'media', 'stats'])).toEqual([
      { widget: 'clock', x: 0, y: 0, w: 3, h: 1 },
      { widget: 'events', x: 0, y: 1, w: 3, h: 1 },
      { widget: 'claude', x: 0, y: 2, w: 3, h: 1 },
      { widget: 'github', x: 3, y: 0, w: 2, h: 1 },
      { widget: 'weather', x: 3, y: 1, w: 2, h: 1 },
      { widget: 'media', x: 3, y: 2, w: 2, h: 1 },
    ]);
    expect(columnsToGrid(['events'], ['printer', 'events'])).toEqual([
      { widget: 'events', x: 0, y: 0, w: 3, h: 3 },
      { widget: 'printer', x: 3, y: 0, w: 2, h: 1 },
      { widget: 'events', x: 3, y: 1, w: 2, h: 2 },
    ]);
    const { grid, ...columns } = HOME;
    expect(normalizeHome(columns as RawMessage).grid).toEqual(grid);
  });

  it('does not show a widget twice', () => {
    const raw = { type: 'home', left: ['stats', 'stats'], right: ['stats', 'media', 'x'] };
    expect(normalizeHome(raw).grid.map((g) => g.widget)).toEqual(['stats', 'media']);
  });

  it('hides widgets whose page is off, and the clock next to the top bar', () => {
    const grid = columnsToGrid(['clock', 'claude'], ['net', 'stats']);
    const shown = (header: boolean, ...pages: ('ai' | 'network' | 'stats')[]) =>
      visibleWidgets({ header, grid }, ['home', ...pages]).map((g) => g.widget);
    expect(shown(false, 'ai', 'network', 'stats')).toEqual(['clock', 'claude', 'net', 'stats']);
    expect(shown(true, 'stats')).toEqual(['stats']);
  });
});

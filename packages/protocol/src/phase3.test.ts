// The messages behind the games, printer and GitHub pages.
import { describe, expect, it } from 'vitest';
import { parseCommand } from './commands.js';
import { parseMessage } from './companion.js';
import { normalizeGitHub } from './github.js';
import { normalizePrinters } from './printer.js';
import { addPortrait, normalizeSteam } from './steam.js';

// As the functions named here return them at the pinned commit.
const GAME = { appid: 570, name: 'Dota 2', last: 5000, total_min: 900 };
const STEAM = {
  // steam.py, Steam.snapshot()
  type: 'steam',
  found: true,
  playing: { appid: 0xc0000001, name: 'Minecraft', session_s: 2880, total_min: 7680 },
  recent: [GAME],
  friends: [{ name: 'alex', game: 'Portal' }],
};
const PRINTER = {
  // printer_poll.py, make_message()
  name: 'Voron',
  model: 'Voron 2.4',
  online: true,
  state: 'RUNNING',
  pct: 47,
  remaining_min: 48,
  layer: 112,
  layers: 240,
  file: 'Desk_Organizer',
  nozzle: 220.4,
  nozzle_target: 220,
  bed: 55,
  bed_target: 55,
  chamber: null,
  speed: '100%',
  error: '',
  ams: [{ color: '#FFB224', type: 'PETG', active: true }],
};
const OFFLINE = {
  // printer.py, offline_message()
  ...{ name: 'A1', model: 'A1 mini', online: false, state: 'OFFLINE', pct: 0, remaining_min: 0, layer: 0, layers: 0 },
  ...{ file: '', nozzle: null, nozzle_target: null, bed: null, bed_target: null, chamber: null, speed: '', error: '' },
  ams: [],
};
const PRINTERS = { type: 'printer', printers: [PRINTER, OFFLINE] };
const GITHUB = {
  // github.py, message()
  type: 'github',
  login: 'octocat',
  total: 1033,
  levels: '0123',
  start_wday: 5,
  months: [[1, 'Dec']],
  today: 3,
  week: 5,
  last_week: 2,
  streak: 3,
  longest: 10,
  best: 75,
  best_date: 'Nov 16',
  week_days: [2, 3],
  last_week_days: [0, 0, 0, 0, 0, 0, 2],
  kinds: { commits: 120, prs: 4, reviews: 2, issues: 1, private: 907 },
  repos: [{ name: 'pixel-garden', count: 222 }],
  accent: false,
};

describe('schemas', () => {
  it.each([
    STEAM,
    { type: 'steam', found: false, playing: null, recent: [] },
    PRINTERS,
    { type: 'printer', printers: [] },
    GITHUB,
    { ...GITHUB, kinds: {}, repos: [], levels: '' },
  ])('know %j', (message) => {
    expect(parseMessage(message).kind).toBe('known');
  });

  it.each([
    { type: 'steam', recent: 'none' },
    { type: 'printer', printers: [{ pct: '4' }] },
    { type: 'github', levels: 4 },
  ])('do not fit %j', (message) => {
    expect(parseMessage(message).kind).toBe('mismatch');
  });
});

describe('normalizeSteam', () => {
  it('reads what the companion sends', () => {
    expect(normalizeSteam(STEAM)).toEqual({
      found: true,
      playing: { appid: 0xc0000001, name: 'Minecraft', last: 0, total: 7680, session: 2880 },
      recent: [{ appid: 570, name: 'Dota 2', last: 5000, total: 900 }],
      friends: [{ name: 'alex', game: 'Portal' }],
    });
  });

  it('gives ids that a launch may have, above 2^31 too', () => {
    const { playing } = normalizeSteam(STEAM);
    const command = { type: 'steam_launch', appid: playing!.appid };
    expect(parseCommand(JSON.stringify(command))).toEqual(command);
  });

  it('falls back like the board', () => {
    expect(normalizeSteam({ type: 'steam' })).toEqual({ found: false, playing: null, recent: [], friends: [] });
    expect(normalizeSteam({ type: 'steam', playing: [], recent: [4], friends: [null] })).toEqual({
      found: false,
      playing: null,
      recent: [{ appid: 0, name: '', last: 0, total: 0 }],
      friends: [{ name: '', game: '' }],
    });
  });

  it('takes 5 games and 5 friends', () => {
    const many = normalizeSteam({ ...STEAM, recent: Array(9).fill(GAME), friends: Array(9).fill({}) });
    expect(many.recent).toHaveLength(5);
    expect(many.friends).toHaveLength(5);
  });
});

describe('addPortrait', () => {
  const full = new Map([1, 2, 3, 4, 5].map((id) => [id, `p${id}`]));
  const add = (id: number, recent: number[], from: ReadonlyMap<number, string> = full) => [
    ...addPortrait(from, id, 'new', new Set(recent)).keys(),
  ];

  it('adds while there is room', () => {
    expect(add(9, [], new Map())).toEqual([9]);
    expect(add(9, [], new Map([...full].slice(0, 4)))).toEqual([1, 2, 3, 4, 9]);
  });

  it("replaces the same game's", () => {
    const next = addPortrait(full, 2, 'new', new Set());
    expect(next.size).toBe(5);
    expect(next.get(2)).toBe('new');
  });

  it('replaces one that is no longer recent, the oldest first', () => {
    expect(add(9, [9, 1, 2, 4, 5])).toEqual([1, 2, 4, 5, 9]);
    expect(add(9, [9, 1, 5])).toEqual([1, 3, 4, 5, 9]);
  });

  it('replaces the oldest when all are recent', () => {
    expect(add(9, [1, 2, 3, 4, 5])).toEqual([2, 3, 4, 5, 9]);
    // A newer picture makes a game the newest.
    const refreshed = addPortrait(full, 1, 'new', new Set());
    expect(add(9, [1, 2, 3, 4, 5], refreshed)).toEqual([3, 4, 5, 1, 9]);
  });

  it('never has more than 5, and leaves the old map alone', () => {
    let portraits: Map<number, string> = new Map();
    for (let id = 1; id <= 40; id++) portraits = addPortrait(portraits, id, 'x', new Set([id, id - 1]));
    expect([...portraits.keys()]).toContain(39);
    expect(portraits.size).toBe(5);
    expect(full.size).toBe(5);
  });
});

describe('normalizePrinters', () => {
  it('reads what the companion sends', () => {
    const [printer, offline] = normalizePrinters(PRINTERS);
    expect(printer).toEqual({
      online: true,
      name: 'Voron',
      model: 'Voron 2.4',
      state: 'RUNNING',
      file: 'Desk_Organizer',
      speed: '100%',
      error: '',
      pct: 47,
      remaining: 48,
      layer: 112,
      layers: 240,
      nozzle: 220.4,
      nozzleTarget: 220,
      bed: 55,
      bedTarget: 55,
      chamber: null,
      filaments: [{ color: '#ffb224', type: 'PETG', active: true }],
    });
    expect(offline).toMatchObject({ online: false, state: 'OFFLINE', nozzle: null, filaments: [] });
  });

  it('falls back like the board', () => {
    expect(normalizePrinters({ type: 'printer' })).toEqual([]);
    const [printer] = normalizePrinters({ type: 'printer', printers: [{ nozzle: 0, ams: [{}] }] });
    expect(printer).toMatchObject({ state: '', nozzle: 0, bed: null, filaments: [{ color: '#444444', type: '', active: false }] });
  });

  it('takes 4 printers with 8 filaments', () => {
    const printers = normalizePrinters({ type: 'printer', printers: Array(6).fill({ ams: Array(12).fill({}) }) });
    expect(printers).toHaveLength(4);
    expect(printers[0]!.filaments).toHaveLength(8);
  });
});

describe('normalizeGitHub', () => {
  it('reads what the companion sends', () => {
    expect(normalizeGitHub(GITHUB)).toEqual({
      login: 'octocat',
      accent: false,
      total: 1033,
      today: 3,
      week: 5,
      lastWeek: 2,
      streak: 3,
      longest: 10,
      best: 75,
      bestDate: 'Nov 16',
      startWeekday: 5,
      levels: [0, 1, 2, 3],
      months: [{ column: 1, name: 'Dec' }],
      weekDays: [2, 3],
      lastWeekDays: [0, 0, 0, 0, 0, 0, 2],
      commits: 120,
      prs: 4,
      reviews: 2,
      issues: 1,
      privateCount: 907,
      repos: [{ name: 'pixel-garden', commits: 222 }],
    });
  });

  it('keeps the newest 378 days, and shifts the first weekday and the months', () => {
    // 8 too many, from a Friday: the first day left is a Saturday, 1 column later.
    const raw = { ...GITHUB, levels: `${'4'.repeat(8)}${'1'.repeat(378)}`, start_wday: 5, months: [[0, 'Nov'], [1, 'Dec'], [5, 'Jan']] };
    const github = normalizeGitHub(raw);
    expect(github.levels).toHaveLength(378);
    expect(github.levels.every((l) => l === 1)).toBe(true);
    expect(github.startWeekday).toBe(6);
    expect(github.months).toEqual([
      { column: 0, name: 'Dec' },
      { column: 4, name: 'Jan' },
    ]);
  });

  it('cuts nothing at exactly 378 days', () => {
    const github = normalizeGitHub({ ...GITHUB, levels: '2'.repeat(378) });
    expect(github).toMatchObject({ startWeekday: 5, months: [{ column: 1, name: 'Dec' }] });
    expect(github.levels).toHaveLength(378);
  });

  it('falls back like the board', () => {
    const github = normalizeGitHub({
      type: 'github',
      levels: '05x4',
      months: [['1', 'Dec'], [2], 3, [4, 'Feb']],
      week_days: [1, null],
      last_week_days: [1],
      kinds: 4,
    });
    expect(github).toMatchObject({
      login: '',
      levels: [0, 0, 0, 4],
      months: [{ column: 4, name: 'Feb' }],
      weekDays: [1, 0],
      lastWeekDays: [1, 0, 0, 0, 0, 0, 0],
      commits: 0,
      repos: [],
    });
  });

  it('takes 14 months, 4 repositories and 7 days', () => {
    const github = normalizeGitHub({
      ...GITHUB,
      months: Array(20).fill([1, 'X']),
      repos: Array(9).fill({}),
      week_days: Array(9).fill(1),
      last_week_days: Array(9).fill(1),
    });
    expect([github.months, github.repos, github.weekDays, github.lastWeekDays].map((a) => a.length)).toEqual([14, 4, 7, 7]);
  });
});

// Games, printers and GitHub.
import { normalizeGitHub, normalizePrinters, normalizeSteam, type GitHub, type Printer } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatLastPlayed,
  formatPlaytime,
  homeGame,
  idleText,
  isTotalWorthShowing,
  LAUNCH_LOCK_MS,
  LaunchStore,
  playingText,
  sessionSeconds,
} from './games.js';
import {
  bestText,
  formatCount,
  homeStreak,
  homeTotal,
  levelColor,
  longestText,
  monthLabels,
  pageChart,
  squares,
  summary,
  tallChart,
  totalWeeks,
  weekChange,
  wideChart,
} from './github.js';
import {
  formatDone,
  formatRemaining,
  formatTemp,
  homePrinter,
  isDarkFilament,
  printerView,
  shownPrinter,
  stateColor,
  stateText,
} from './printers.js';

const NOW = 1_800_000_000;

describe('games', () => {
  const steam = normalizeSteam({
    type: 'steam',
    found: true,
    playing: { appid: 1, name: 'Starfall', session_s: 2880, total_min: 7680 },
    recent: [{ appid: 2, name: 'Harbor', last: NOW - 7200, total_min: 2460 }],
    friends: [{ name: 'a', game: 'x' }, { name: 'b', game: 'y' }],
  });
  const idle = { ...steam, playing: null };

  it.each([
    [0, '0 dk'],
    [59, '59 dk'],
    [60, '1,0 sa'],
    [300, '5,0 sa'],
    [599, '10,0 sa'],
    [600, '10 sa'],
    [2490, '41 sa'],
  ])('%d minutes: %s', (m, text) => expect(formatPlaytime(m)).toBe(text));

  it.each([
    [10, 'Az önce'],
    [3600, '1 saat önce'],
    [86_400, 'Dün'],
    [2 * 86_400, '2 gün önce'],
    [60 * 86_400, '2 ay önce'],
  ])('%d s ago: %s', (s, text) => expect(formatLastPlayed(NOW - s, NOW)).toBe(text));

  it('never played', () => expect(formatLastPlayed(0, NOW)).toBe(''));

  it('shows a total once it is clearly more than the session', () => {
    expect(isTotalWorthShowing(0, 0)).toBe(false);
    expect(isTotalWorthShowing(57, 2880)).toBe(false);
    expect(isTotalWorthShowing(58, 2880)).toBe(true);
  });

  it('counts the session on from the message, and stops when the PC goes offline', () => {
    const at = (offlineSince: number | null, now: number) =>
      sessionSeconds(steam, { steamAt: NOW * 1000, offlineSince }, now);
    expect(at(null, NOW)).toBe(2880);
    expect(at(null, NOW + 90)).toBe(2970);
    expect(at((NOW + 60) * 1000, NOW + 90)).toBe(2940);
    expect(at((NOW + 60) * 1000, NOW + 9000)).toBe(2940);
    // Offline since before the message, as after a reload while the PC is off.
    expect(at((NOW - 60) * 1000, NOW + 90)).toBe(2880);
    // A clock that was set back.
    expect(at(null, NOW - 500)).toBe(2880);
    expect(sessionSeconds(idle, { steamAt: 0, offlineSince: null }, NOW)).toBe(0);
  });

  it('what is being played', () => {
    expect(playingText(steam, 2880)).toEqual({ time: '48 dk süredir oynanıyor', total: 'toplam 128 sa, 2 arkadaş oyunda' });
    expect(playingText({ ...steam, friends: steam.friends.slice(1) }, 3720).total).toContain('1 arkadaş oyunda');
    expect(playingText({ ...steam, friends: [] }, 3720)).toEqual({ time: '1 sa 2 dk süredir oynanıyor', total: 'toplam 128 sa' });
    expect(playingText({ ...steam, friends: [] }, 7680 * 60).total).toBe('');
  });

  it('nothing being played', () => {
    expect(idleText(null, true)).toBe('PC bekleniyor');
    expect(idleText(null, false)).toBe('PC çevrimdışı');
    expect(idleText(idle, true)).toBe('Bir oyun başlat ya da aşağıdan seç');
    expect(idleText({ ...idle, found: false }, true)).toBe('PC’de Steam kurulu değil');
  });

  it('the Home card', () => {
    expect(homeGame(steam, 2880, true, NOW)).toEqual({ caption: 'Oynanıyor', sub: '48 dk, 128 sa', name: 'Starfall' });
    expect(homeGame(idle, 0, true, NOW)).toEqual({ caption: 'Son oynanan', sub: '2 saat önce, 41 sa', name: 'Harbor' });
    const empty = { ...idle, recent: [] };
    expect(homeGame(empty, 0, true, NOW)).toEqual({ caption: 'Steam', sub: 'Henüz oynanan oyun yok', name: '' });
    expect(homeGame({ ...empty, found: false }, 0, true, NOW).sub).toBe('Steam bulunamadı');
    expect(homeGame(null, 0, false, NOW).sub).toBe('PC çevrimdışı');
  });
});

describe('LaunchStore', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('locks every game for 5 seconds', () => {
    const launches = new LaunchStore();
    const send = vi.fn();
    launches.launch(1, send);
    expect(launches.getState()).toBe(1);
    launches.launch(1, send);
    launches.launch(2, send);
    vi.advanceTimersByTime(LAUNCH_LOCK_MS - 1);
    launches.launch(2, send);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(launches.getState()).toBeNull();
    launches.launch(2, send);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('printers', () => {
  const [base] = normalizePrinters({ type: 'printer', printers: [{ name: 'P', model: 'M', online: true, state: 'IDLE' }] });
  const printer = (change: Partial<Printer>): Printer => ({ ...base!, ...change });
  const running = printer({ state: 'RUNNING', pct: 47, remaining: 48, layer: 112, layers: 240, file: 'Box', speed: '100%' });
  const at = new Date('2026-11-20T09:01:00').getTime();

  it.each([
    ['RUNNING', 'Basıyor', 'var(--accent)'],
    ['PREPARE', 'Hazırlanıyor', 'var(--accent)'],
    ['SLICING', 'Dilimleniyor', 'var(--accent)'],
    ['PAUSE', 'Duraklatıldı', 'var(--warn)'],
    ['FINISH', 'Bitti', 'var(--good)'],
    ['FAILED', 'Başarısız', 'var(--bad)'],
    ['IDLE', 'Boşta', 'var(--dim)'],
    ['OFFLINE', 'Çevrimdışı', 'var(--dim)'],
    ['DANCING', 'DANCING', 'var(--dim)'],
    ['', 'Bilinmiyor', 'var(--dim)'],
    ['toString', 'toString', 'var(--dim)'],
  ])('state %s', (state, text, color) => {
    expect([stateText(state), stateColor(state)]).toEqual([text, color]);
  });

  it('shows the picked one, else the first at work, else the first', () => {
    const list = [printer({}), running, printer({ state: 'PAUSE' })];
    expect(shownPrinter(list, null)).toBe(1);
    expect(shownPrinter(list, 0)).toBe(0);
    expect(shownPrinter(list, 2)).toBe(2);
    // There are fewer printers than there were.
    expect(shownPrinter(list, 3)).toBe(1);
    expect(shownPrinter([printer({}), printer({ state: 'FINISH' })], null)).toBe(0);
  });

  it('formats', () => {
    expect([null, 0, 219.6, 219.4, -0.4, -2.5].map(formatTemp)).toEqual(['--', '0°', '220°', '219°', '0°', '-3°']);
    expect([0, 59, 60, 125].map(formatRemaining)).toEqual(['0 dk kaldı', '59 dk kaldı', '1 sa 0 dk kaldı', '2 sa 5 dk kaldı']);
    expect(formatDone(48, at)).toBe('Bitiş 09:49');
    expect(formatDone(18 * 60 - 1, at)).toBe('Bitiş 03:00');
    expect(formatDone(18 * 60, at)).toBe('Bitiş Cmt 03:01');
    expect([isDarkFilament('#101010'), isDarkFilament('#202020'), isDarkFilament('#ffb224')]).toEqual([true, false, false]);
  });

  it('a print', () => {
    expect(printerView(running, at)).toEqual({
      pct: 47,
      remaining: '48 dk kaldı',
      done: formatDone(48, at),
      layer: 'Katman 112 / 240',
      fileCaption: 'Basılıyor',
      file: 'Box',
      speed: '%100 hız',
    });
    expect(printerView({ ...running, remaining: 0 }, at)).toMatchObject({ remaining: '', done: '' });
  });

  it('says when it is done by when the message came, not by the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(at);
    const first = printerView(running, at).done;
    vi.setSystemTime(at + 25 * 60_000);
    expect(printerView(running, at).done).toBe(first);
    vi.useRealTimers();
  });

  it('a finished print, and none', () => {
    expect(printerView({ ...running, state: 'FINISH', pct: 99 }, at)).toMatchObject({
      pct: 100,
      remaining: '',
      done: 'Alınmaya hazır',
      layer: 'Katman 112 / 240',
      fileCaption: 'Son baskı',
      speed: '',
    });
    expect(printerView({ ...running, state: 'FAILED' }, at)).toMatchObject({ pct: null, layer: '', fileCaption: 'Son dosya' });
    expect(printerView(printer({}), at)).toMatchObject({ pct: null, file: '--' });
  });

  it('the Home card', () => {
    expect(homePrinter([])).toMatchObject({ file: 'Yazıcı bağlı değil', state: '', pct: 0 });
    expect(homePrinter([printer({}), running])).toEqual({
      state: 'P, Basıyor',
      color: 'var(--accent)',
      file: 'Box',
      pct: 47,
      info: '%47, 48 dk kaldı',
    });
    expect(homePrinter([printer({ name: '', state: 'FINISH', pct: 3 })])).toMatchObject({
      state: 'M, Bitti',
      pct: 100,
      info: 'Bitti, alınmaya hazır',
    });
    expect(homePrinter([printer({ state: 'SLICING', pct: 5 })])).toMatchObject({ state: 'P, Boşta', color: 'var(--dim)', pct: 0 });
    expect(homePrinter([printer({ state: 'OFFLINE' })])).toMatchObject({ state: 'P, Çevrimdışı', file: 'Baskı yok' });
    expect(homePrinter([printer({ state: 'FAILED' })]).color).toBe('var(--bad)');
    expect(homePrinter([printer({ state: 'PREPARE' })]).file).toBe('Basılıyor');
  });
});

describe('GitHub', () => {
  // 371 days from a Sunday to a Saturday: 53 columns.
  const github: GitHub = normalizeGitHub({
    type: 'github',
    total: 1033,
    levels: `${'0'.repeat(370)}4`,
    start_wday: 0,
    months: [[0, 'Nov'], [1, 'Dec'], [5, 'Jan'], [50, 'Oct'], [52, 'Nov']],
    streak: 5,
    today: 3,
    longest: 10,
    best: 75,
    best_date: 'Nov 16',
    week: 281,
    last_week: 101,
    kinds: { commits: 120, private: 907, issues: 1 },
  });

  it('has a column per week', () => {
    expect(totalWeeks(null)).toBe(53);
    expect(totalWeeks(github)).toBe(53);
    expect(totalWeeks({ ...github, levels: [1], startWeekday: 6 })).toBe(1);
    expect(totalWeeks({ ...github, levels: [1, 1], startWeekday: 6 })).toBe(2);
  });

  it('has a square per day, with today last', () => {
    const all = squares(github, 53);
    expect(all).toHaveLength(371);
    expect(all.at(-1)).toEqual({ column: 52, row: 6, level: 4, today: true });
    expect(all.filter((s) => s.today)).toHaveLength(1);
  });

  it('shows the newest weeks when there is no room for all', () => {
    const some = squares(github, 10);
    expect(some).toHaveLength(70);
    expect(some[0]).toMatchObject({ column: 0, row: 0 });
    expect(some.at(-1)).toMatchObject({ column: 9, today: true });
  });

  it('starts in the middle of a week', () => {
    const late = squares({ ...github, levels: [1, 2, 3], startWeekday: 5 }, 2);
    expect(late.map((s) => [s.column, s.row])).toEqual([[0, 5], [0, 6], [1, 0]]);
  });

  it('is empty squares before the first message', () => {
    expect(squares(null, 2)).toHaveLength(14);
    expect(squares(null, 2).every((s) => s.level === 0 && !s.today)).toBe(true);
  });

  it('leaves out month labels that crowd or stick out', () => {
    // Nov at 0, Dec at 12 would crowd; Jan at 60; Oct at 600 fits, Nov at 624 doesn't.
    expect(monthLabels(github, 53, 12).map((m) => m.name)).toEqual(['Kas', 'Oca', 'Eki']);
    expect(monthLabels(github, 10, 12)).toEqual([{ x: 84, name: 'Eki' }]);
    expect(monthLabels(null, 53, 12)).toEqual([]);
  });

  it('fits the page, down to a size that can be seen', () => {
    expect(pageChart(github, 640, 200)).toEqual({ pitch: 12, weeks: 53 });
    expect(pageChart(github, 2000, 200)).toEqual({ pitch: 16, weeks: 53 });
    expect(pageChart(github, 300, 200)).toEqual({ pitch: 9, weeks: 33 });
    expect(pageChart(github, 0, 0).weeks).toBe(1);
    expect(pageChart(github, 2000, 80)).toEqual({ pitch: 11, weeks: 53 });
  });

  it('fits the Home card', () => {
    expect(wideChart(github, 500, 90)).toEqual({ pitch: 13, weeks: 38 });
    expect(tallChart(github, 636, 150)).toEqual({ pitch: 12, weeks: 53 });
    expect(tallChart(github, 200, 60)).toEqual({ pitch: 8, weeks: 25 });
    expect(wideChart(null, 0, 0)).toEqual({ pitch: 6, weeks: 1 });
  });

  it('has colours', () => {
    expect(levelColor(0, false)).toBe(levelColor(9, false));
    expect(levelColor(4, false)).toBe('#39d353');
    expect(levelColor(4, true)).toContain('var(--accent) 100%');
  });

  it('texts', () => {
    expect(formatCount(1234567)).toBe('1.234.567');
    expect(summary(github)).toBe('1.033 katkı, 120 commit, 907 gizli, 1 issue');
    expect(longestText(github)).toBe('10 gün');
    expect(longestText({ ...github, longest: 1 })).toBe('1 gün');
    expect(bestText(github)).toBe('16 Kas, 75');
    expect(bestText({ ...github, best: 0 })).toBe('--');
    expect(homeTotal(github)).toBe('son bir yılda 1.033, 907 gizli');
    expect(homeTotal({ ...github, privateCount: 0 })).toBe('son bir yılda 1.033');
    expect(homeStreak(github)).toBe('5 günlük seri');
    expect(homeStreak({ ...github, streak: 0 })).toBe('bugün 3');
  });

  it('this week against last week', () => {
    const change = (week: number, lastWeek: number) => weekChange({ ...github, week, lastWeek });
    expect(change(281, 101)).toEqual({ text: 'geçen haftadan 180 fazla', more: true });
    expect(change(1, 3)).toEqual({ text: 'geçen haftadan 2 az', more: false });
    expect(change(3, 3).text).toBe('geçen haftayla aynı');
    expect(change(0, 0).text).toBe('');
  });
});

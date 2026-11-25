// Made-up data for the mock companion, with the fields and rounding of the real one.
import { STEAM_HEADER, STEAM_PORTRAIT, STEAM_THUMB } from '@deskhub-mobile/protocol';
import type {
  AiMessage,
  AlertMessage,
  Command,
  EventsMessage,
  GitHubMessage,
  HomeMessage,
  LayoutMessage,
  MediaMessage,
  MediaServerMessage,
  NetMessage,
  PrinterMessage,
  StatsMessage,
  SteamMessage,
  TilesMessage,
  TileStateMessage,
} from '@deskhub-mobile/protocol';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits: number) => Number(v.toFixed(digits));

/** A value that wanders around, pulled back to `rest`. */
class Wander {
  #value: number;

  constructor(
    private readonly rest: number,
    private readonly step: number,
    private readonly min: number,
    private readonly max: number,
  ) {
    this.#value = rest;
  }

  next(): number {
    const pull = (this.rest - this.#value) * 0.08;
    this.#value = clamp(this.#value + pull + (Math.random() * 2 - 1) * this.step, this.min, this.max);
    return this.#value;
  }
}

/** Makes messages with the fields and rounding of Stats.sample() in companion/deskhub/stats.py. */
export function createStatsSource(): () => StatsMessage {
  const cpu = new Wander(28, 9, 1, 100);
  const gpu = new Wander(45, 11, 0, 100);
  const gpuTemp = new Wander(54, 0.8, 38, 83);
  const ram = new Wander(18.4, 0.08, 6, 31);
  const vram = new Wander(6.2, 0.1, 1, 12);
  const down = new Wander(900, 700, 0, 12_000);
  const up = new Wander(160, 120, 0, 2_500);
  // No cpu_temp: the companion doesn't send it.
  return () => ({
    type: 'stats',
    cpu: round(cpu.next(), 1),
    ram_used: round(ram.next(), 2),
    ram_total: 31.9,
    net_down: round(down.next(), 1),
    net_up: round(up.next(), 1),
    disk: 58.1,
    cpu_name: 'AMD Ryzen 7 7800X3D 8-Core',
    gpu_name: 'GeForce RTX 4070',
    gpu: Math.round(gpu.next()),
    gpu_temp: Math.round(gpuTemp.next()),
    vram_used: round(vram.next(), 2),
    vram_total: 12,
  });
}

type Rgb = readonly [number, number, number];

/** A cover frame (art_frame in companion/deskhub/media.py) with a sun over two colours. */
export function coverFrame(magic: 'ART1' | 'ARS1', id: number, width: number, height: number, top: Rgb, bottom: Rgb): Buffer {
  const frame = Buffer.alloc(12 + width * height * 2);
  frame.write(magic, 'latin1');
  writeSize(frame, id, width, height);
  paint(frame.subarray(12), width, height, top, bottom);
  return frame;
}

function writeSize(frame: Buffer, id: number, width: number, height: number): void {
  frame.writeUInt32LE(id, 4);
  frame.writeUInt16LE(width, 8);
  frame.writeUInt16LE(height, 10);
}

function paint(pixels: Buffer, width: number, height: number, top: Rgb, bottom: Rgb): void {
  const radius = Math.min(width, height) / 5;
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const sun = Math.hypot(x - width / 2, y - height / 3) < radius;
      const [r, g, b] = sun ? [248, 222, 160] : top.map((c, i) => c + (bottom[i]! - c) * t);
      pixels.writeUInt16LE(((r! & 0xf8) << 8) | ((g! & 0xfc) << 3) | (b! >> 3), (y * width + x) * 2);
    }
  }
}

/** A game's cover (build_frame and KIND_SIZES in companion/deskhub/steam.py). */
export function steamFrame(appid: number, kind: number, top: Rgb, bottom: Rgb): Buffer {
  const [width, height] = ([[340, 159], [64, 96], [96, 144]] as const)[kind]!;
  const frame = Buffer.alloc(16 + width * height * 2);
  frame.write('STM1', 'latin1');
  writeSize(frame, appid, width, height);
  frame.writeUInt16LE(kind, 12);
  paint(frame.subarray(16), width, height, top, bottom);
  return frame;
}

interface Track {
  title: string;
  artist: string;
  album: string;
  dur: number;
  top: Rgb;
  bottom: Rgb;
}

const TRACKS: readonly Track[] = [
  { title: 'Midnight City Lights', artist: 'Synth Dreams', album: 'Neon Skyline', dur: 241, top: [38, 28, 110], bottom: [120, 40, 150] },
  {
    title: 'A Rather Long Title That Does Not Fit Next to Its Cover, Not Even on a Wide Phone',
    artist: 'The Verbose Quartet',
    album: 'Sentences',
    dur: 187,
    top: [12, 74, 84],
    bottom: [20, 140, 110],
  },
  { title: 'Short One', artist: 'Brief', album: '', dur: 25, top: [130, 40, 30], bottom: [220, 120, 40] },
];

/** A media player that obeys commands. */
export class MockPlayer {
  #track = 0;
  #pos = 75;
  #playing = true;

  get cover(): Buffer {
    const { top, bottom } = TRACKS[this.#track]!;
    return coverFrame('ART1', this.#track + 1, 280, 280, top, bottom);
  }

  message(): MediaMessage {
    const { title, artist, album, dur } = TRACKS[this.#track]!;
    return {
      type: 'media',
      active: true,
      playing: this.#playing,
      title,
      artist,
      album,
      source: 'Spotify',
      pos: this.#pos,
      dur,
      can_seek: true,
      art_id: this.#track + 1,
    };
  }

  /** A second passed. True when the track changed. */
  tick(): boolean {
    if (!this.#playing) return false;
    this.#pos++;
    return this.#pos > TRACKS[this.#track]!.dur && this.#skip(1);
  }

  /** True when the track changed. */
  command({ cmd, value }: Extract<Command, { type: 'media' }>): boolean {
    if (cmd === 'next') return this.#skip(1);
    if (cmd === 'prev') return this.#skip(-1);
    if (cmd === 'toggle') this.#playing = !this.#playing;
    else this.#pos = Math.min(value, TRACKS[this.#track]!.dur);
    return false;
  }

  #skip(by: number): true {
    this.#track = (this.#track + by + TRACKS.length) % TRACKS.length;
    this.#pos = 0;
    return true;
  }
}

export const SERVER_COVER = coverFrame('ARS1', 900, 186, 280, [20, 30, 60], [150, 60, 60]);

/** A Jellyfin server with a film on. */
export function serverMessage(pos: number): MediaServerMessage {
  return {
    type: 'media_server',
    configured: true,
    online: true,
    streams: 1,
    transcoding: 0,
    name: 'Attic',
    kind: 'jellyfin',
    version: 'Jellyfin 10.10.3',
    library: '312 movies, 45 shows, 2,104 episodes',
    active: true,
    playing: true,
    title: 'The Lighthouse Keeper',
    artist: '2019',
    album: 'alex on Living Room TV',
    source: 'Attic',
    pos: pos % 5400,
    dur: 5400,
    can_seek: true,
    controls: true,
    art_id: 900,
  };
}

export const LAYOUT: LayoutMessage = {
  type: 'layout',
  pages: [
    'home',
    'stats',
    'ai',
    'calendar',
    'weather',
    'media',
    'printer',
    'timer',
    'games',
    'network',
    'github',
    'shortcuts',
  ],
  ordered: true,
  nav: 'left',
  pc_sleep: 'off',
  night_start: -1,
  night_end: -1,
  night_style: 'off',
};

export const HOME: HomeMessage = {
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

/** Events around `now`, in epoch seconds. */
export function eventsMessage(now: number): EventsMessage {
  const midnight = new Date(now * 1000).setHours(0, 0, 0, 0) / 1000;
  const day = 86_400;
  const at = (start: number, hours: number) => ({ start, end: start + hours * 3600, all_day: false });
  return {
    type: 'events',
    days: 7,
    events: [
      { title: 'Conference', loc: '', cal: 'Work', color: '#f5a524', start: midnight, end: midnight + 2 * day, all_day: true },
      { title: 'Stand-up', loc: 'Room 2', cal: 'Work', color: '#f5a524', ...at(now - 600, 0.5) },
      { title: 'Design review', loc: '', cal: 'Work', color: '#6cb4ff', ...at(now + 3600, 1) },
      { title: 'Dentist', loc: 'Main Street 12', cal: 'Personal', color: '#3dd68c', ...at(midnight + day + 9.5 * 3600, 1) },
      { title: 'Dinner with everyone who could make it on a weekday after all', loc: 'Harbour', cal: 'Personal', color: '#b49cff', ...at(midnight + 4 * day + 19 * 3600, 3) },
    ],
  };
}

export const TILES: TilesMessage = {
  type: 'tiles',
  tiles: [
    { label: 'Mute mic', icon: 'mic_off', color: '#b4413c' },
    { label: 'Mute sound', icon: 'volume_off', color: '#3a4256' },
    { label: 'Vol -', icon: 'volume_down', color: '#3a4256' },
    { label: 'Vol +', icon: 'volume_up', color: '#3a4256' },
    { label: 'Screenshot', icon: 'screenshot_monitor', color: '#2f6f5e' },
    { label: 'Terminal', icon: 'terminal', color: '#2b2f3a' },
    { label: 'Downloads', icon: 'folder', color: '#8a6d1f' },
    { label: 'No such icon', icon: 'teapot', color: '#5b3fa0' },
  ],
};

/** The first two tiles are toggles. */
const TOGGLES = 2;

export class MockTiles {
  readonly #on = new Set([0]);

  message(): TileStateMessage {
    return { type: 'tile_state', on: [...this.#on] };
  }

  /** True when a tile went on or off. */
  tap(id: number): boolean {
    if (id >= TOGGLES) return false;
    if (!this.#on.delete(id)) this.#on.add(id);
    return true;
  }
}

const MODELS = [
  { name: 'Opus', share: 0.64 },
  { name: 'Sonnet', share: 0.31 },
  { name: 'Haiku', share: 0.05 },
];

/** Claude Code at work: usage grows with every message. */
export class MockUsage {
  #tokens = 48_200_000;
  #messages = 214;
  #pct = 38;

  /** `now` in epoch seconds. */
  message(now: number): AiMessage {
    this.#tokens += Math.round(Math.random() * 60_000);
    this.#messages += Math.random() < 0.3 ? 1 : 0;
    this.#pct = this.#pct >= 99 ? 2 : round(this.#pct + Math.random() * 0.4, 1);
    // Windows that end on whole hours.
    const hour = 3600;
    const reset5h = (Math.floor(now / hour) + 3) * hour;
    const reset7d = (Math.floor(now / (24 * hour)) + 4) * 24 * hour;
    return {
      type: 'ai',
      provider: 'claude',
      limits: {
        five_hour: { pct: this.#pct, reset: reset5h },
        seven_day: { pct: 61, reset: reset7d },
        updated: now - 20,
      },
      block: { active: true, reset: reset5h, tokens: 6_100_000, messages: 31 },
      today: { tokens: this.#tokens, output: Math.round(this.#tokens * 0.004), messages: this.#messages },
      last_hour: 6_100_000,
      days: [32e6, 8e6, 21e6, 55e6, 41e6, 62e6, this.#tokens],
      models: MODELS.map(({ name, share }) => ({ name, tokens: Math.round(this.#tokens * share) })),
    };
  }
}

const ALERTS: readonly AlertMessage[] = [
  {
    type: 'alert',
    id: 'mock-permission',
    kind: 'permission',
    agent: 'claude',
    title: 'Claude wants to use Bash',
    detail: 'pnpm --filter @deskhub-mobile/web run build && pnpm test',
    project: 'deskhub-mobile',
  },
  {
    type: 'alert',
    id: 'mock-input',
    kind: 'input',
    agent: 'claude',
    title: 'Waiting for your reply',
    detail: 'Finished. The tests pass.',
    project: 'a-project-with-quite-a-long-name',
  },
];

/** Alerts that come now and then and obey their buttons. */
export class MockAlerts {
  #next = 0;
  #shown: AlertMessage | null = null;

  message(): AlertMessage {
    return this.#shown ?? { type: 'alert', clear: true };
  }

  raise(): void {
    this.#shown = ALERTS[this.#next++ % ALERTS.length]!;
  }

  clear(): void {
    this.#shown = null;
  }

  /** True when the alert is gone. Showing the window doesn't grant a permission. */
  command({ id, action }: Extract<Command, { type: 'alert_action' }>): boolean {
    if (id !== this.#shown?.id || (action === 'focus' && this.#shown.kind === 'permission')) return false;
    this.clear();
    return true;
  }
}

/** Latency with a lost probe now and then, and a speed test. */
export class MockNet {
  readonly #wander = new Wander(18, 3, 8, 90);
  #history: number[] = [];
  #today = 3.2e9;
  #month = 4.12e11;
  #speed: NetMessage['speed'] = null;
  #testing = false;

  /** A probe, every 2 seconds. */
  probe(): void {
    const ms = Math.random() < 0.04 ? -1 : Math.round(this.#wander.next() + (Math.random() < 0.03 ? 70 : 0));
    this.#history = [...this.#history, ms].slice(-60);
    this.#today += 2e6;
    this.#month += 2e6;
  }

  /** False when a test is running already. */
  startTest(): boolean {
    if (this.#testing) return false;
    return (this.#testing = true);
  }

  /** `now` in epoch seconds. */
  endTest(now: number): void {
    this.#testing = false;
    this.#speed = { down_mbps: 942.3, up_mbps: 38.1, ping_ms: 9.2, at: now };
  }

  /** `now` in epoch seconds. */
  message(now: number): NetMessage {
    const answered = this.#history.filter((ms) => ms >= 0);
    return {
      type: 'net',
      online: true,
      latency_ms: answered.at(-1) ?? null,
      jitter_ms: answered.length > 1 ? 2.1 : null,
      loss_pct: Math.round((100 * (this.#history.length - answered.length)) / Math.max(1, this.#history.length)),
      hist: this.#history,
      up_since: now - 277_200,
      last_drop: { at: now - 277_200, dur_s: 45 },
      today_bytes: this.#today,
      month_bytes: this.#month,
      speed: this.#speed,
      testing: this.#testing,
      ip: '',
    };
  }
}

interface MockGame {
  appid: number;
  name: string;
  total: number;
  /** Seconds ago. */
  ago: number;
  top: Rgb;
  bottom: Rgb;
}

const GAMES: readonly MockGame[] = [
  { appid: 1001, name: 'Harbor Lights', total: 2460, ago: 7200, top: [40, 90, 150], bottom: [220, 150, 110] },
  { appid: 1002, name: 'Iron Orchard', total: 990, ago: 100_000, top: [60, 130, 60], bottom: [200, 200, 120] },
  // A custom game.
  { appid: 0xc0000003, name: 'Neon Drift', total: 724, ago: 400_000, top: [60, 10, 80], bottom: [200, 30, 120] },
  { appid: 1004, name: 'Frostline: The Very Long Subtitle', total: 300, ago: 2e6, top: [130, 190, 230], bottom: [240, 250, 255] },
  { appid: 1005, name: 'Ember Keep', total: 0, ago: 1.2e7, top: [110, 30, 20], bottom: [230, 110, 40] },
  { appid: 1006, name: 'Starfall Tactics', total: 7680, ago: 3e7, top: [40, 30, 100], bottom: [120, 70, 160] },
];

/** A games library. What is launched runs for a while. */
export class MockGames {
  readonly #lastPlayed = new Map<number, number>();
  #playing: MockGame | null = null;
  #since = 0;

  /** `now` in epoch seconds. */
  message(now: number): SteamMessage {
    const recent = this.#recent(now).map(({ game, last }) => ({
      appid: game.appid,
      name: game.name,
      last,
      total_min: game.total,
    }));
    const playing = this.#playing && {
      appid: this.#playing.appid,
      name: this.#playing.name,
      session_s: now - this.#since,
      total_min: this.#playing.total,
    };
    const friends = [
      { name: 'alex', game: 'Harbor Lights' },
      { name: 'sam_with_a_long_name', game: 'Frostline: The Very Long Subtitle' },
    ];
    return { type: 'steam', found: true, playing, recent, friends };
  }

  /** In the order of Steam._wanted(). */
  covers(now: number): Buffer[] {
    const recent = this.#recent(now).map(({ game }) => game);
    const thumb = this.#playing ?? recent[0];
    const frame = (game: MockGame, kind: number) => steamFrame(game.appid, kind, game.top, game.bottom);
    return [
      ...(this.#playing ? [frame(this.#playing, STEAM_HEADER)] : []),
      ...(thumb ? [frame(thumb, STEAM_THUMB)] : []),
      ...recent.map((game) => frame(game, STEAM_PORTRAIT)),
    ];
  }

  /** False when the companion would refuse it. */
  launch(appid: number, now: number): boolean {
    const game = this.#recent(now).find((g) => g.game.appid === appid)?.game;
    if (!game) return false;
    this.stop(now);
    this.#playing = game;
    this.#since = now;
    return true;
  }

  stop(now: number): void {
    if (this.#playing) this.#lastPlayed.set(this.#playing.appid, now);
    this.#playing = null;
  }

  #recent(now: number): { game: MockGame; last: number }[] {
    return GAMES.filter((game) => game !== this.#playing)
      .map((game) => ({ game, last: this.#lastPlayed.get(game.appid) ?? Math.trunc(now - game.ago) }))
      .sort((a, b) => b.last - a.last)
      .slice(0, 5);
  }
}

const PRINT_MINUTES = 90;

/** Two printers: one goes through a print and back to the start, the other comes and goes. */
export function printerMessage(tick: number): PrinterMessage {
  const pct = tick % 110;
  const state = pct < 3 ? 'PREPARE' : pct >= 100 ? 'FINISH' : pct % 40 > 36 ? 'PAUSE' : 'RUNNING';
  const online = tick % 60 < 40;
  const nothing = { pct: 0, remaining_min: 0, layer: 0, layers: 0, file: '', speed: '', error: '', chamber: null };
  return {
    type: 'printer',
    printers: [
      {
        name: 'Attic Voron',
        model: 'Voron 2.4',
        online: true,
        state,
        pct: Math.min(100, pct),
        remaining_min: Math.round((PRINT_MINUTES * Math.max(0, 100 - pct)) / 100),
        layer: Math.round(2.4 * Math.min(100, pct)),
        layers: 240,
        file: 'Desk_Organizer_v3_final_really_final',
        nozzle: 219.6,
        nozzle_target: 220,
        bed: 55.2,
        bed_target: 55,
        chamber: 34,
        speed: '100%',
        error: state === 'PAUSE' ? 'Filament ran out' : '',
        ams: [
          { color: '#F0F0F0', type: 'PLA', active: false },
          { color: '#101010', type: 'PLA', active: false },
          { color: '#FFB224', type: 'PETG', active: true },
          { color: '#3A7BFF', type: 'PLA', active: false },
        ],
      },
      {
        ...nothing,
        name: 'A1 mini',
        model: 'A1 mini',
        online,
        state: online ? 'IDLE' : 'OFFLINE',
        nozzle: online ? 24 : null,
        nozzle_target: online ? 0 : null,
        bed: online ? 23 : null,
        bed_target: online ? 0 : null,
        ams: [],
      },
    ],
  };
}

/** A year of contributions up to `now`, in epoch seconds. */
export function githubMessage(now: number): GitHubMessage {
  const today = new Date(now * 1000);
  // From the Sunday 52 weeks before this week's, as GitHub does.
  const days = 52 * 7 + today.getDay() + 1;
  const counts = Array.from({ length: days }, (_, i) => {
    const busy = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    return Math.abs(busy) < 0.45 && i < days - 5 ? 0 : Math.ceil(Math.abs(busy) * (i > days - 40 ? 24 : 9));
  });
  const months: [number, string][] = [];
  for (let i = 0; i < days; i += 7) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    if (day.getDate() <= 7) months.push([i / 7, new Intl.DateTimeFormat('en-US', { month: 'short' }).format(day)]);
  }
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
  const thisWeek = counts.slice(days - 1 - today.getDay());
  const lastWeek = counts.slice(days - 8 - today.getDay(), days - 1 - today.getDay());
  return {
    type: 'github',
    login: 'octocat',
    total: sum(counts),
    levels: counts.map((n) => Math.min(4, Math.ceil(n / 4))).join(''),
    start_wday: 0,
    months,
    today: counts.at(-1)!,
    week: sum(thisWeek),
    last_week: sum(lastWeek),
    streak: 5,
    longest: 10,
    best: Math.max(...counts),
    best_date: 'Nov 16',
    week_days: thisWeek,
    last_week_days: lastWeek,
    kinds: { commits: 820, prs: 61, reviews: 40, issues: 12, private: 1207 },
    repos: [
      { name: 'pixel-garden', count: 222 },
      { name: 'tide-engine', count: 201 },
      { name: 'a-repository-with-a-rather-long-name', count: 111 },
      { name: 'lumen-notes', count: 88 },
    ],
    accent: false,
  };
}

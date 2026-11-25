// Made-up data for the mock companion, with the fields and rounding of the real one.
import type {
  Command,
  EventsMessage,
  HomeMessage,
  LayoutMessage,
  MediaMessage,
  MediaServerMessage,
  StatsMessage,
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
  frame.writeUInt32LE(id, 4);
  frame.writeUInt16LE(width, 8);
  frame.writeUInt16LE(height, 10);
  const radius = width / 5;
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const sun = Math.hypot(x - width / 2, y - height / 3) < radius;
      const [r, g, b] = sun ? [248, 222, 160] : top.map((c, i) => c + (bottom[i]! - c) * t);
      frame.writeUInt16LE(((r! & 0xf8) << 8) | ((g! & 0xfc) << 3) | (b! >> 3), 12 + (y * width + x) * 2);
    }
  }
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
  pages: ['home', 'stats', 'ai', 'calendar', 'weather', 'media', 'timer', 'network', 'shortcuts'],
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

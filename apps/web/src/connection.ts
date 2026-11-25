// The connection to the bridge: reconnects by itself and holds the latest data.
import {
  addPortrait,
  applyLayout,
  CLOSE_BAD_ORIGIN,
  CLOSE_BAD_TOKEN,
  DEFAULT_HOME,
  DEFAULT_LAYOUT,
  NO_MEDIA,
  normalizeAlert,
  normalizeEvents,
  normalizeGitHub,
  normalizeHome,
  normalizeMedia,
  normalizeMediaServer,
  normalizeNet,
  normalizePcPower,
  normalizePrinters,
  normalizeStats,
  normalizeSteam,
  normalizeTiles,
  normalizeTileState,
  normalizeUsage,
  SILENCE_TIMEOUT_MS,
  STEAM_HEADER,
  STEAM_PORTRAIT,
  STEAM_THUMB,
  TOKEN_PARAM,
  type Alert,
  type BridgeMessage,
  type Command,
  type Events,
  type GitHub,
  type Home,
  type Layout,
  type Media,
  type MediaServer,
  type MediaTarget,
  type Net,
  type Printer,
  type RawMessage,
  type Stats,
  type Steam,
  type Tile,
  type Usage,
  type WeatherSettings,
} from '@deskhub-mobile/protocol';
import { readCover, type Cover } from './cover.js';
import type { SavedLayout } from './layoutStore.js';

/** What the page starts with. */
export interface SavedData extends SavedLayout {
  events?: Events;
}

/** How far back the history goes. */
export const HISTORY_MS = 60_000;

const BACKOFF_MIN_MS = 500;
const BACKOFF_MAX_MS = 15_000;

export type Link =
  | 'connecting'
  | 'open'
  /** No token, or the bridge refused it. Waits for setToken(). */
  | 'bad_token'
  /** The bridge doesn't allow this page's origin. Retrying won't help. */
  | 'bad_origin';

export interface HistoryPoint {
  /** When it arrived, ms. */
  t: number;
  cpu: number;
  gpu: number | null;
}

/** What companion messages add up to. */
export interface HubData {
  stats: Stats | null;
  media: Media;
  /** When `media` arrived, ms. */
  mediaAt: number;
  server: MediaServer;
  serverAt: number;
  events: Events;
  tiles: readonly Tile[];
  /** Tiles that are on. */
  lit: ReadonlySet<number>;
  layout: Layout;
  home: Home;
  /** Of the AI agent. */
  usage: Usage | null;
  /** null: nothing is waiting. undefined: no message about it. */
  alert: Alert | null | undefined;
  net: Net | null;
  /** When `net` arrived, ms. */
  netAt: number;
  /** The PC's display sleeps. Stays when the link drops: a PC that sleeps takes the bridge along. */
  asleep: boolean;
  steam: Steam | null;
  /** When `steam` arrived, ms. */
  steamAt: number;
  printers: readonly Printer[];
  printersAt: number;
  github: GitHub | null;
}

/** Covers of games; each shows for its own game only. */
export interface GameCovers {
  header: Cover | null;
  thumb: Cover | null;
  /** By app id. */
  portraits: ReadonlyMap<number, Cover>;
}

export interface BridgeState extends HubData {
  link: Link;
  /** As last reported. Only means something while the link is open; see isOnline(). */
  pcOnline: boolean;
  /** The last minute, oldest first. */
  history: readonly HistoryPoint[];
  /** The last cover of the PC and of the media server; see coverOf(). */
  covers: Readonly<Record<'pc' | 'server', Cover | null>>;
  gameCovers: GameCovers;
  /** When the PC went offline, ms. null: it is online. */
  offlineSince: number | null;
  /** undefined: the bridge hasn't said yet. null: no location is set. */
  weather: WeatherSettings | null | undefined;
  /** The last message of every type, as received. */
  messages: Readonly<Record<string, RawMessage>>;
}

/** Without what outlives a bridge that has forgotten it. */
const NO_DATA: Omit<HubData, 'layout' | 'home' | 'events'> = {
  stats: null,
  media: NO_MEDIA,
  mediaAt: 0,
  server: normalizeMediaServer({ type: 'media_server' }),
  serverAt: 0,
  tiles: [],
  lit: new Set(),
  usage: null,
  alert: undefined,
  net: null,
  netAt: 0,
  asleep: false,
  steam: null,
  steamAt: 0,
  printers: [],
  printersAt: 0,
  github: null,
};

/** What a companion message changes. */
function read(message: RawMessage, layout: Layout): Partial<HubData> {
  switch (message.type) {
    case 'stats':
      return { stats: normalizeStats(message) };
    case 'media':
      return { media: normalizeMedia(message), mediaAt: Date.now() };
    case 'media_server':
      return { server: normalizeMediaServer(message), serverAt: Date.now() };
    case 'events':
      return { events: normalizeEvents(message) };
    case 'tiles':
      return { tiles: normalizeTiles(message) };
    case 'tile_state':
      return { lit: normalizeTileState(message) };
    case 'layout':
      return { layout: applyLayout(layout, message) };
    case 'home':
      return { home: normalizeHome(message) };
    case 'ai':
    case 'claude':
      return { usage: normalizeUsage(message) };
    case 'alert':
      return { alert: normalizeAlert(message) };
    case 'net':
      return { net: normalizeNet(message), netAt: Date.now() };
    case 'pc_power':
      return { asleep: normalizePcPower(message) };
    case 'steam':
      return { steam: normalizeSteam(message), steamAt: Date.now() };
    case 'printer':
      return { printers: normalizePrinters(message), printersAt: Date.now() };
    case 'github':
      return { github: normalizeGitHub(message) };
    default:
      return {};
  }
}

/** Whether the companion can be reached: what the board calls "PC online". */
export const isOnline = (state: BridgeState): boolean => state.link === 'open' && state.pcOnline;

/** What plays on the PC. The board takes nothing for granted while it is offline (tick_cb in ui.c). */
export const pcMedia = (state: BridgeState): Media => (isOnline(state) ? state.media : NO_MEDIA);

/** Delay before reconnect attempt `attempt` (0, 1, 2...): doubles, with jitter, up to a limit. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const full = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** Math.min(attempt, 10));
  return full * (0.5 + random() / 2);
}

export class Connection {
  #state: BridgeState;
  readonly #listeners = new Set<() => void>();
  readonly #url: string;
  #token: string | null;
  #socket: WebSocket | null = null;
  #attempt = 0;
  #retry: ReturnType<typeof setTimeout> | undefined;
  #watchdog: ReturnType<typeof setTimeout> | undefined;

  /** `url` is the /client address without the token. */
  constructor(
    url: string,
    token: string | null,
    { layout, home, events = normalizeEvents({ type: 'events' }) }: SavedData = { layout: DEFAULT_LAYOUT, home: DEFAULT_HOME },
  ) {
    this.#url = url;
    this.#token = token;
    this.#state = {
      ...NO_DATA,
      link: 'connecting',
      pcOnline: false,
      history: [],
      covers: { pc: null, server: null },
      gameCovers: { header: null, thumb: null, portraits: new Map() },
      offlineSince: Date.now(),
      weather: undefined,
      messages: {},
      layout,
      home,
      events,
    };
  }

  // Arrow functions, so they can go straight to useSyncExternalStore().
  readonly getState = (): BridgeState => this.#state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  setToken(token: string): void {
    this.#token = token;
    this.#attempt = 0;
    this.connect();
  }

  /** Connects now, dropping whatever connection or wait there is. */
  connect(): void {
    this.#drop();
    if (!this.#token) {
      this.#update({ link: 'bad_token' });
      return;
    }
    this.#update({ link: 'connecting' });
    const socket = new WebSocket(`${this.#url}?${TOKEN_PARAM}=${encodeURIComponent(this.#token)}`);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;
    socket.onmessage = (e) => this.#onMessage(e.data);
    socket.onclose = (e) => this.#onClose(e.code);
    this.#feedWatchdog();
  }

  /** Cuts a wait for the next attempt short, e.g. when the screen turns on. */
  wake(): void {
    if (this.#retry === undefined) return;
    this.#attempt = 0;
    this.connect();
  }

  /** Sends a command to the companion, unless it is offline. */
  send(command: Command): void {
    if (isOnline(this.#state)) this.#socket?.send(JSON.stringify(command));
  }

  /** What the media buttons send (ui_send_media and ui_send_server in ui.c). */
  sendMedia(type: MediaTarget, cmd: 'toggle' | 'next' | 'prev' | 'seek', value = 0): void {
    this.send({ type, cmd, value });
  }

  #onMessage(data: unknown): void {
    this.#feedWatchdog();
    if (data instanceof ArrayBuffer) {
      this.#onCover(data);
      return;
    }
    let message: RawMessage;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (typeof message?.type !== 'string') return;

    if (message.type === 'bridge.snapshot' || message.type === 'bridge.status') {
      this.#onBridgeMessage(message as unknown as BridgeMessage);
      return;
    }
    const change = read(message, this.#state.layout);
    this.#update({
      ...change,
      messages: { ...this.#state.messages, [message.type]: message },
      ...(change.stats ? { history: this.#historyWith(change.stats) } : {}),
    });
  }

  #onCover(data: ArrayBuffer): void {
    const found = readCover(data);
    if (!found) return;
    const { art, cover } = found;
    const { covers, gameCovers, steam } = this.#state;
    if (art.magic !== 'STM1') {
      this.#update({ covers: { ...covers, [art.magic === 'ART1' ? 'pc' : 'server']: cover } });
      return;
    }
    const recent = new Set(steam?.recent.map((game) => game.appid));
    this.#update({
      gameCovers: {
        header: art.kind === STEAM_HEADER ? cover : gameCovers.header,
        thumb: art.kind === STEAM_THUMB ? cover : gameCovers.thumb,
        portraits:
          art.kind === STEAM_PORTRAIT ? addPortrait(gameCovers.portraits, art.id, cover, recent) : gameCovers.portraits,
      },
    });
  }

  #historyWith(stats: Stats): HistoryPoint[] {
    const t = Date.now();
    const recent = this.#state.history.filter((p) => p.t > t - HISTORY_MS && p.t <= t);
    return [...recent, { t, cpu: stats.cpu, gpu: stats.gpu }];
  }

  #onBridgeMessage(message: BridgeMessage): void {
    if (message.type === 'bridge.status') {
      this.#update({ pcOnline: message.pc_online });
      return;
    }
    // The bridge let us in.
    this.#attempt = 0;
    // Its stats aren't part of the history: there's no telling how old they are.
    let data: HubData = { ...this.#state, ...NO_DATA };
    for (const m of message.messages) data = { ...data, ...read(m, data.layout) };
    // Seen before, so it has been running for as long as then.
    const { messages, steamAt, printersAt } = this.#state;
    const known = (m: RawMessage) => JSON.stringify(m) === JSON.stringify(messages[m.type]);
    for (const m of message.messages) {
      if (m.type === 'steam' && known(m)) data = { ...data, steamAt };
      if (m.type === 'printer' && known(m)) data = { ...data, printersAt };
    }
    this.#update({
      ...this.#state,
      ...data,
      link: 'open',
      pcOnline: message.pc_online,
      weather: message.weather ?? null,
      messages: Object.fromEntries(message.messages.map((m) => [m.type, m])),
    });
  }

  #onClose(code: number): void {
    this.#drop();
    if (code === CLOSE_BAD_TOKEN) return this.#update({ link: 'bad_token' });
    if (code === CLOSE_BAD_ORIGIN) return this.#update({ link: 'bad_origin' });
    this.#update({ link: 'connecting' });
    this.#retry = setTimeout(() => this.connect(), backoffDelay(this.#attempt++));
  }

  /**
   * The bridge sends a heartbeat even while the PC is offline, so silence means the
   * bridge is out of reach. A socket on a lost Wi-Fi connection may never close by itself.
   */
  #feedWatchdog(): void {
    clearTimeout(this.#watchdog);
    this.#watchdog = setTimeout(() => this.#onClose(0), SILENCE_TIMEOUT_MS);
  }

  /** Forgets the socket without waiting for it to close. */
  #drop(): void {
    clearTimeout(this.#retry);
    clearTimeout(this.#watchdog);
    this.#retry = undefined;
    const socket = this.#socket;
    this.#socket = null;
    if (!socket) return;
    socket.onmessage = socket.onclose = null;
    socket.close();
  }

  #update(change: Partial<BridgeState>): void {
    const next = { ...this.#state, ...change };
    next.offlineSince = isOnline(next) ? null : (next.offlineSince ?? Date.now());
    this.#state = next;
    for (const listener of this.#listeners) listener();
  }
}

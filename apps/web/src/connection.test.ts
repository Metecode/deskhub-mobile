import {
  CLOSE_BAD_ORIGIN,
  CLOSE_BAD_TOKEN,
  DEFAULT_LAYOUT,
  NO_MEDIA,
  SILENCE_TIMEOUT_MS,
  STATUS_INTERVAL_MS,
} from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoffDelay, Connection, HISTORY_MS, isOnline, pcMedia } from './connection.js';

class FakeSocket {
  static all: FakeSocket[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  closed = false;
  readonly sent: unknown[] = [];

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }

  close(): void {
    this.closed = true;
  }

  send(text: string): void {
    this.sent.push(JSON.parse(text));
  }

  receiveBinary(data: ArrayBuffer): void {
    this.onmessage?.({ data });
  }

  receive(message: object | string): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  snapshot(pc_online: boolean, messages: object[] = [], weather: object | null = null): void {
    this.receive({ type: 'bridge.snapshot', pc_online, messages, weather });
  }
}

const sockets = () => FakeSocket.all;
const last = () => FakeSocket.all.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
  FakeSocket.all = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function connect(token: string | null = 'a b'): Connection {
  const connection = new Connection('ws://hub/client', token);
  connection.connect();
  return connection;
}

describe('backoffDelay', () => {
  it('doubles up to 15 seconds', () => {
    const delays = [0, 1, 2, 3, 4, 5, 6, 50].map((n) => backoffDelay(n, () => 1));
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  });

  it('has jitter of up to half', () => {
    expect(backoffDelay(0, () => 0)).toBe(250);
  });
});

describe('connecting', () => {
  it('sends the token and is open after the snapshot', () => {
    const connection = connect();
    expect(last().url).toBe('ws://hub/client?token=a%20b');
    expect(connection.getState().link).toBe('connecting');
    last().snapshot(true, [{ type: 'stats', cpu: 12 }]);
    expect(connection.getState()).toMatchObject({ link: 'open', pcOnline: true, stats: { cpu: 12 }, history: [] });
  });

  it('waits for a token when there is none', () => {
    const connection = connect(null);
    expect(connection.getState().link).toBe('bad_token');
    expect(sockets()).toHaveLength(0);
    connection.setToken('t');
    expect(last().url).toContain('token=t');
  });

  it.each([
    [CLOSE_BAD_TOKEN, 'bad_token'],
    [CLOSE_BAD_ORIGIN, 'bad_origin'],
  ])('stops trying after close code %i', (code, link) => {
    const connection = connect();
    last().onclose!({ code });
    expect(connection.getState().link).toBe(link);
    vi.advanceTimersByTime(10 * 60_000);
    connection.wake();
    expect(sockets()).toHaveLength(1);
  });

  it('reconnects with backoff, starting over once it was open', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    connect();
    for (const delay of [500, 1000, 2000]) {
      const count = sockets().length;
      last().onclose!({ code: 1006 });
      vi.advanceTimersByTime(delay - 1);
      expect(sockets()).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(sockets()).toHaveLength(count + 1);
    }
    last().snapshot(true);
    const count = sockets().length;
    last().onclose!({ code: 1006 });
    vi.advanceTimersByTime(500);
    expect(sockets()).toHaveLength(count + 1);
  });

  it('wake() retries at once, and only while waiting', () => {
    const connection = connect();
    connection.wake();
    expect(sockets()).toHaveLength(1);
    last().onclose!({ code: 1006 });
    connection.wake();
    expect(sockets()).toHaveLength(2);
    vi.advanceTimersByTime(14_000);
    expect(sockets()).toHaveLength(2);
  });
});

describe('watchdog', () => {
  it('reconnects after 15 seconds of silence, even if the socket never closes', () => {
    const connection = connect();
    last().snapshot(true);
    const dead = last();
    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS);
    expect(connection.getState().link).toBe('connecting');
    expect(dead.closed).toBe(true);
    vi.advanceTimersByTime(500);
    expect(sockets()).toHaveLength(2);
    // Whatever the old socket still does has no effect.
    dead.receive({ type: 'bridge.snapshot', pc_online: true, messages: [] });
    expect(connection.getState().link).toBe('connecting');
  });

  it('stays quiet while the PC is offline, because of the heartbeat', () => {
    const connection = connect();
    last().snapshot(false);
    for (let t = 0; t < 10 * 60_000; t += STATUS_INTERVAL_MS) {
      vi.advanceTimersByTime(STATUS_INTERVAL_MS);
      last().receive({ type: 'bridge.status', pc_online: false });
      expect(connection.getState()).toMatchObject({ link: 'open', pcOnline: false });
    }
    expect(sockets()).toHaveLength(1);
  });

  it('also covers a connection attempt that hangs', () => {
    connect();
    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS + 500);
    expect(sockets()).toHaveLength(2);
  });
});

describe('data', () => {
  it('follows the online state', () => {
    const connection = connect();
    last().snapshot(false);
    last().receive({ type: 'bridge.status', pc_online: true });
    expect(connection.getState().pcOnline).toBe(true);
  });

  it('keeps a minute of history', () => {
    const connection = connect();
    last().snapshot(true);
    for (let i = 0; i < 90; i++) {
      last().receive({ type: 'stats', cpu: i });
      vi.advanceTimersByTime(1000);
    }
    const { history } = connection.getState();
    expect(history).toHaveLength(HISTORY_MS / 1000);
    expect(history.at(-1)).toMatchObject({ cpu: 89, gpu: null });
  });

  it('keeps the history across a reconnect', () => {
    const connection = connect();
    last().snapshot(true);
    last().receive({ type: 'stats', cpu: 5 });
    last().onclose!({ code: 1006 });
    vi.advanceTimersByTime(500);
    last().snapshot(true, [{ type: 'stats', cpu: 5 }]);
    expect(connection.getState().history).toHaveLength(1);
  });

  it('keeps messages it does not know and survives bad ones', () => {
    const connection = connect();
    last().snapshot(true);
    for (const bad of ['', 'nope', 'null', '1', '[]', '{}']) last().receive(bad);
    last().receive({ type: 'weather_v9', x: 1 });
    last().receive({ type: 'stats', cpu: 'busy' });
    expect(connection.getState().messages).toMatchObject({ weather_v9: { x: 1 } });
    expect(connection.getState().stats?.cpu).toBe(0);
  });
});

describe('pages', () => {
  const layout = { type: 'layout', pages: ['home', 'media'], ordered: true, nav: 'bottom' };
  const home = { type: 'home', header: false, grid: [{ widget: 'stats', x: 0, y: 0, w: 1, h: 1 }] };
  const media = { type: 'media', active: true, title: 'A', art_id: 3 };

  it('have their data, from the snapshot and live', () => {
    const connection = connect();
    const events = { type: 'events', events: [{ title: 'E', start: 1, end: 2 }], days: 3 };
    last().snapshot(true, [layout, home, media, events, { type: 'tile_state', on: [1] }]);
    expect(connection.getState()).toMatchObject({
      layout: { pages: ['home', 'media'], nav: 'bottom' },
      home: { header: false },
      media: { title: 'A', artId: 3 },
      events: { days: 3, events: [{ title: 'E' }] },
      lit: new Set([1]),
    });
    last().receive({ type: 'tiles', tiles: [{ label: 'T' }] });
    last().receive({ type: 'media_server', configured: true, name: 'S' });
    last().receive({ type: 'tile_state', on: [] });
    expect(connection.getState()).toMatchObject({ tiles: [{ label: 'T' }], server: { name: 'S' }, lit: new Set() });
  });

  it('start with the bar on the left, and keep the layout when a snapshot has none', () => {
    const connection = connect();
    expect(connection.getState().layout).toEqual(DEFAULT_LAYOUT);
    last().snapshot(true, [layout, home, media]);
    // The bridge was restarted.
    last().snapshot(false);
    expect(connection.getState()).toMatchObject({ layout: { nav: 'bottom' }, home: { header: false }, media: NO_MEDIA });
  });

  it('keep their data while the bridge is out of reach, but nothing plays then', () => {
    const connection = connect();
    last().snapshot(true, [media, { type: 'events', events: [{ title: 'E' }] }]);
    expect(pcMedia(connection.getState()).title).toBe('A');
    last().receive({ type: 'bridge.status', pc_online: false });
    expect(pcMedia(connection.getState())).toEqual(NO_MEDIA);
    last().receive({ type: 'bridge.status', pc_online: true });
    last().onclose!({ code: 1006 });
    expect(isOnline(connection.getState())).toBe(false);
    expect(pcMedia(connection.getState())).toEqual(NO_MEDIA);
    expect(connection.getState().events.events).toHaveLength(1);
  });

  it('get covers as they come', () => {
    const connection = connect();
    last().snapshot(true, [media]);
    const frame = new Uint8Array(14);
    frame.set([...'ART1'].map((c) => c.charCodeAt(0)));
    frame.set([3, 0, 0, 0, 1, 0, 1, 0], 4);
    last().receiveBinary(frame.buffer);
    last().receiveBinary(new ArrayBuffer(5));
    expect(connection.getState().covers).toMatchObject({ pc: { id: 3, width: 1 }, server: null });
  });

  it('get the weather settings from the snapshot', () => {
    const connection = connect();
    expect(connection.getState().weather).toBeUndefined();
    last().snapshot(true);
    expect(connection.getState().weather).toBeNull();
    const weather = { latitude: 1, longitude: 2, city: '', units: 'metric' };
    last().snapshot(true, [], weather);
    expect(connection.getState().weather).toEqual(weather);
  });
});

describe('sleep of the PC', () => {
  const asleep = { type: 'pc_power', asleep: true };
  const awake = { type: 'pc_power', asleep: false };

  it('lasts while the bridge is out of reach, and ends with the companion\'s next session', () => {
    const connection = connect();
    last().snapshot(true, [awake]);
    last().receive(asleep);
    expect(connection.getState().asleep).toBe(true);
    // The PC suspends: everything goes silent.
    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS + 60_000);
    expect(connection.getState()).toMatchObject({ link: 'connecting', asleep: true });
    // It wakes. The bridge is first, with what it knew.
    last().snapshot(false, [asleep]);
    expect(connection.getState().asleep).toBe(true);
    last().receive(awake);
    expect(connection.getState().asleep).toBe(false);
  });

  it('is over when the companion was faster than the phone', () => {
    const connection = connect();
    last().snapshot(true, [asleep]);
    last().onclose!({ code: 1006 });
    vi.advanceTimersByTime(60_000);
    last().snapshot(true, [awake]);
    expect(connection.getState().asleep).toBe(false);
  });

  it('is over when the bridge was restarted, as the PC must be on then', () => {
    const connection = connect();
    last().snapshot(true, [asleep]);
    last().snapshot(false);
    expect(connection.getState().asleep).toBe(false);
  });

  it('outlasts a companion that stops, as on the board', () => {
    const connection = connect();
    last().snapshot(true, [asleep]);
    last().receive({ type: 'bridge.status', pc_online: false });
    expect(connection.getState().asleep).toBe(true);
  });
});

describe('AI, alerts and the internet', () => {
  it('have their data', () => {
    vi.setSystemTime(5000);
    const connection = connect();
    expect(connection.getState()).toMatchObject({ usage: null, alert: undefined, net: null });
    last().snapshot(true, [
      { type: 'ai', provider: 'codex' },
      { type: 'alert', id: 'a', kind: 'permission' },
      { type: 'net', online: true },
    ]);
    expect(connection.getState()).toMatchObject({
      usage: { provider: 'codex' },
      alert: { id: 'a', permission: true },
      net: { online: true },
      netAt: 5000,
    });
    last().receive({ type: 'claude' });
    last().receive({ type: 'alert', clear: true });
    expect(connection.getState()).toMatchObject({ usage: { provider: 'claude' }, alert: null });
    last().snapshot(false);
    expect(connection.getState().alert).toBeUndefined();
  });
});

describe('games, printers and GitHub', () => {
  const steam = { type: 'steam', found: true, playing: { appid: 1, session_s: 60 }, recent: [{ appid: 2 }] };
  const printer = { type: 'printer', printers: [{ name: 'P' }] };
  const frame = (appid: number, kind: number) => {
    const data = new DataView(new ArrayBuffer(18));
    for (const [i, c] of [...'STM1'].entries()) data.setUint8(i, c.charCodeAt(0));
    data.setUint32(4, appid, true);
    data.setUint16(8, 1, true);
    data.setUint16(10, 1, true);
    data.setUint16(12, kind, true);
    return data.buffer;
  };

  it('have their data', () => {
    vi.setSystemTime(5000);
    const connection = connect();
    expect(connection.getState()).toMatchObject({ steam: null, printers: [], github: null });
    last().snapshot(true, [steam, printer, { type: 'github', total: 7 }]);
    expect(connection.getState()).toMatchObject({
      steam: { playing: { appid: 1 } },
      steamAt: 5000,
      printers: [{ name: 'P' }],
      printersAt: 5000,
      github: { total: 7 },
    });
  });

  it('keep the time of a message that a reconnect brings again', () => {
    vi.setSystemTime(5000);
    const connection = connect();
    last().snapshot(true, [steam, printer]);
    vi.setSystemTime(65_000);
    last().snapshot(true, [steam, { ...printer, printers: [] }]);
    expect(connection.getState()).toMatchObject({ steamAt: 5000, printersAt: 65_000 });
  });

  it('get covers by kind, with a portrait per game', () => {
    const connection = connect();
    last().snapshot(true, [steam]);
    for (const [appid, kind] of [[1, 0], [1, 1], [2, 2], [3, 2], [2, 2]] as const) last().receiveBinary(frame(appid, kind));
    last().receiveBinary(frame(9, 3));
    const { header, thumb, portraits } = connection.getState().gameCovers;
    expect([header?.id, thumb?.id]).toEqual([1, 1]);
    expect([...portraits.keys()]).toEqual([3, 2]);
    // Only the recent game's and the newest ones stay.
    for (const appid of [4, 5, 6, 7]) last().receiveBinary(frame(appid, 2));
    expect([...connection.getState().gameCovers.portraits.keys()]).toEqual([2, 4, 5, 6, 7]);
  });

  it('know since when the PC is offline', () => {
    vi.setSystemTime(1000);
    const connection = connect();
    expect(connection.getState().offlineSince).toBe(1000);
    last().snapshot(true);
    expect(connection.getState().offlineSince).toBeNull();
    vi.setSystemTime(2000);
    last().receive({ type: 'bridge.status', pc_online: false });
    vi.setSystemTime(3000);
    last().receive({ type: 'bridge.status', pc_online: false });
    expect(connection.getState().offlineSince).toBe(2000);
    last().receive({ type: 'bridge.status', pc_online: true });
    expect(connection.getState().offlineSince).toBeNull();
    vi.setSystemTime(4000);
    last().onclose!({ code: 1006 });
    expect(connection.getState().offlineSince).toBe(4000);
  });
});

describe('commands', () => {
  it('are sent while the PC is online, and dropped otherwise', () => {
    const connection = connect();
    connection.send({ type: 'shortcut', id: 1 });
    last().snapshot(false);
    connection.send({ type: 'shortcut', id: 2 });
    last().receive({ type: 'bridge.status', pc_online: true });
    connection.send({ type: 'shortcut', id: 3 });
    connection.sendMedia('media', 'toggle');
    connection.sendMedia('media_server', 'seek', 30);
    expect(last().sent).toEqual([
      { type: 'shortcut', id: 3 },
      { type: 'media', cmd: 'toggle', value: 0 },
      { type: 'media_server', cmd: 'seek', value: 30 },
    ]);
    last().onclose!({ code: 1006 });
    connection.send({ type: 'shortcut', id: 4 });
    expect(last().sent).toHaveLength(3);
  });
});

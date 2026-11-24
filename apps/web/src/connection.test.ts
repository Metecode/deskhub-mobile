import { CLOSE_BAD_ORIGIN, CLOSE_BAD_TOKEN, SILENCE_TIMEOUT_MS, STATUS_INTERVAL_MS } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoffDelay, Connection, HISTORY_MS } from './connection.js';

class FakeSocket {
  static all: FakeSocket[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }

  close(): void {
    this.closed = true;
  }

  receive(message: object | string): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  snapshot(pc_online: boolean, messages: object[] = []): void {
    this.receive({ type: 'bridge.snapshot', pc_online, messages });
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

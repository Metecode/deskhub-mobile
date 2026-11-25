import { CLOSE_REPLACED, MAX_FRAME, ONLINE_TIMEOUT_MS, PREAUTH_MAX } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bridge } from './server.js';
import {
  artFrame,
  connectCompanion,
  HUB_TOKEN,
  paddedMessage,
  startBridge,
  TestSocket,
  useFakeTimers,
} from './testing.js';

let bridge: Bridge;

beforeEach(async () => {
  useFakeTimers();
  bridge = await startBridge();
});

afterEach(async () => {
  await bridge.close();
  vi.useRealTimers();
});

const connect = () => new TestSocket(bridge.port, '/ws').open();

describe('hello', () => {
  it('answers the right token with hello_ok first, and goes online', async () => {
    const socket = await connect();
    expect(bridge.hub.online).toBe(false);
    socket.send({ type: 'hello', token: HUB_TOKEN });
    expect(await socket.next()).toEqual({ type: 'hello_ok', version: '0.1.0' });
    expect(bridge.hub.online).toBe(true);
    expect(bridge.companion.connected).toBe(true);
  });

  it.each([{ token: 'wrong' }, { token: '' }, { token: 5 }, { token: null }, {}])('closes on %j', async (fields) => {
    const socket = await connect();
    socket.send({ type: 'hello', ...fields });
    expect((await socket.closed).code).toBe(1008);
    expect(socket.received).toEqual([]);
    expect(bridge.hub.online).toBe(false);
  });

  it('drops the companion when it repeats hello with a wrong token', async () => {
    const socket = await connectCompanion(bridge);
    socket.send({ type: 'hello', token: 'wrong' });
    await socket.closed;
    expect(bridge.companion.connected).toBe(false);
    expect(bridge.hub.online).toBe(false);
  });

  it('keeps the companion when a stranger has a wrong token', async () => {
    await connectCompanion(bridge);
    const stranger = await connect();
    stranger.send({ type: 'hello', token: 'wrong' });
    await stranger.closed;
    expect(bridge.companion.connected).toBe(true);
    expect(bridge.hub.online).toBe(true);
  });

  it('replaces the companion with a new one', async () => {
    const first = await connectCompanion(bridge);
    const second = await connectCompanion(bridge);
    expect((await first.closed).code).toBe(CLOSE_REPLACED);
    expect(bridge.hub.online).toBe(true);
    second.send({ type: 'stats', cpu: 1 });
    await second.flush();
    expect(bridge.hub.messages).toEqual(['{"type":"stats","cpu":1}']);
  });
});

describe('who may connect', () => {
  it.each(['https://evil.example', 'http://localhost:8765', 'null'])('refuses web pages, as from %s', async (origin) => {
    await expect(new TestSocket(bridge.port, '/ws', { origin }).open()).rejects.toThrow('403');
    expect(bridge.companion.connected).toBe(false);
  });

  it('refuses another address than its own', async () => {
    await expect(new TestSocket(bridge.port, '/ws', { localAddress: '127.0.0.2' }).open()).rejects.toThrow('403');
  });
});

describe('before hello', () => {
  it.each([
    ['stats', { type: 'stats', cpu: 1 }],
    ['ping', { type: 'ping' }],
    ['bad json', 'nope'],
    ['exactly 256 bytes', paddedMessage('stats', PREAUTH_MAX)],
    ['a small binary frame', artFrame('ART1')],
    ['an empty frame', ''],
  ])('ignores %s and keeps the connection', async (_name, message) => {
    const socket = await connect();
    socket.send(message);
    await socket.flush();
    expect(bridge.hub.online).toBe(false);
    expect(bridge.hub.messages).toEqual([]);
    socket.send({ type: 'hello', token: HUB_TOKEN });
    expect(await socket.next()).toMatchObject({ type: 'hello_ok' });
  });

  it.each([
    ['text', paddedMessage('stats', PREAUTH_MAX + 1)],
    ['a hello', paddedMessage('hello', PREAUTH_MAX + 1)],
    ['binary', new Uint8Array(PREAUTH_MAX + 1)],
  ])('closes on 257 bytes of %s', async (_name, message) => {
    const socket = await connect();
    socket.send(message);
    expect((await socket.closed).code).toBe(1009);
  });

  it('counts bytes, not characters', async () => {
    const socket = await connect();
    socket.send(JSON.stringify({ type: 'stats', pad: 'ş'.repeat(130) }));
    expect((await socket.closed).code).toBe(1009);
  });
});

describe('after hello', () => {
  it('takes a frame of 300 KiB but closes on one more byte', async () => {
    const socket = await connectCompanion(bridge);
    socket.send(paddedMessage('stats', MAX_FRAME));
    await socket.flush();
    expect(bridge.hub.messages[0]).toHaveLength(MAX_FRAME);
    const offline = new Promise((resolve) => bridge.hub.once('status', resolve));
    socket.send(paddedMessage('stats', MAX_FRAME + 1));
    expect((await socket.closed).code).toBe(1009);
    expect(await offline).toBe(false);
  });

  it('keeps messages that do not fit their schema, and unknown ones, as they are', async () => {
    const socket = await connectCompanion(bridge);
    const texts = [
      '{"type":"stats","cpu":"busy","gpu":null}',
      '{"type":"media_server","configured":false}',
      '{"type":"weather_v9", "spaces":  true}',
    ];
    for (const text of texts) socket.send(text);
    await socket.flush();
    expect(bridge.hub.messages).toEqual(texts);
  });
});

describe('online', () => {
  // Sends a message 4 s after hello, then checks 5 s after hello.
  async function onlineAfter(message: object | string | Uint8Array): Promise<boolean> {
    const socket = await connectCompanion(bridge);
    await vi.advanceTimersByTimeAsync(ONLINE_TIMEOUT_MS - 1000);
    expect(bridge.hub.online).toBe(true);
    socket.send(message);
    await socket.flush();
    await vi.advanceTimersByTimeAsync(1000);
    return bridge.hub.online;
  }

  it('goes offline after 5 seconds of silence, and back online', async () => {
    const socket = await connectCompanion(bridge);
    await vi.advanceTimersByTimeAsync(ONLINE_TIMEOUT_MS - 1);
    expect(bridge.hub.online).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(bridge.hub.online).toBe(false);
    expect(bridge.companion.connected).toBe(true);
    socket.send({ type: 'stats' });
    await socket.flush();
    expect(bridge.hub.online).toBe(true);
  });

  it('goes offline at once when the companion disconnects, keeping its data', async () => {
    const socket = await connectCompanion(bridge);
    socket.send({ type: 'stats', cpu: 5 });
    await socket.flush();
    const offline = new Promise((resolve) => bridge.hub.once('status', resolve));
    socket.ws.terminate();
    expect(await offline).toBe(false);
    expect(bridge.hub.messages).toEqual(['{"type":"stats","cpu":5}']);
  });

  it.each([
    ['stats', { type: 'stats' }],
    ['ping', { type: 'ping' }],
    ['an unknown type', { type: 'weather_v9' }],
    ['a schema mismatch', { type: 'stats', cpu: 'busy' }],
    ['ART1', artFrame('ART1')],
    ['ARS1', artFrame('ARS1')],
    ['STM1', artFrame('STM1')],
  ])('%s keeps the PC online', async (_name, message) => {
    expect(await onlineAfter(message)).toBe(true);
  });

  it.each([
    ['bad json', '{"type":'],
    ['a broken ART1', artFrame('ART1', 1)],
    ['a broken ARS1', artFrame('ARS1', 1)],
    ['a broken STM1', artFrame('STM1', 1)],
    ['an ART1 over 320 x 320', artFrame('ART1', 0, 321, 320)],
    ['an ARS1 over 320 x 320', artFrame('ARS1', 0, 320, 321)],
    ['an unknown magic', Buffer.from('XYZ1 and then some more')],
    ['a truncated frame', Buffer.from('ART1')],
  ])('%s neither keeps the PC online nor breaks the connection', async (_name, message) => {
    expect(await onlineAfter(message)).toBe(false);
    expect(bridge.companion.connected).toBe(true);
  });

  it('WebSocket pings do not keep the PC online', async () => {
    const socket = await connectCompanion(bridge);
    await vi.advanceTimersByTimeAsync(ONLINE_TIMEOUT_MS - 1000);
    await socket.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(bridge.hub.online).toBe(false);
  });
});

describe('state', () => {
  it('keeps the last message of every type, without hello and ping', async () => {
    const socket = await connectCompanion(bridge);
    socket.send({ type: 'stats', cpu: 1 });
    socket.send({ type: 'ping' });
    socket.send({ type: 'alert', id: 'a', title: 'Waiting' });
    socket.send({ type: 'stats', cpu: 2 });
    socket.send({ type: 'alert', clear: true });
    await socket.flush();
    expect(bridge.hub.messages).toEqual(['{"type":"stats","cpu":2}', '{"type":"alert","clear":true}']);
  });

  it('has the display power of the newest session (the companion sends it after every hello)', async () => {
    const asleep = await connectCompanion(bridge);
    asleep.send({ type: 'layout', pc_sleep: 'off' });
    asleep.send({ type: 'pc_power', asleep: true });
    await asleep.flush();
    // The PC suspends: the connection is gone, but it is still asleep.
    asleep.ws.terminate();
    await new Promise((resolve) => bridge.hub.once('status', resolve));
    expect(bridge.hub.messages).toContain('{"type":"pc_power","asleep":true}');

    const awake = await connectCompanion(bridge);
    awake.send({ type: 'layout', pc_sleep: 'off' });
    awake.send({ type: 'pc_power', asleep: false });
    await awake.flush();
    expect(bridge.hub.messages).toContain('{"type":"pc_power","asleep":false}');
    expect(bridge.hub.messages).toHaveLength(2);
  });
});

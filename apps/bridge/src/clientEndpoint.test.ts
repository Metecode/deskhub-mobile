import { hostname } from 'node:os';
import {
  CLOSE_BAD_ORIGIN,
  CLOSE_BAD_TOKEN,
  ONLINE_TIMEOUT_MS,
  SILENCE_TIMEOUT_MS,
  STATUS_INTERVAL_MS,
} from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lanAddresses } from './origins.js';
import type { Bridge } from './server.js';
import {
  artFrame,
  CLIENT_TOKEN,
  connectClient,
  connectCompanion,
  HUB_TOKEN,
  startBridge,
  steamFrame,
  TestSocket,
  useFakeTimers,
} from './testing.js';

let bridge: Bridge;

beforeEach(async () => {
  useFakeTimers();
  bridge = await startBridge({ clientOrigins: ['http://hub.lan:9000'] });
});

afterEach(async () => {
  await bridge.close();
  vi.useRealTimers();
});

/** toEqual() goes through large frames byte by byte, which takes seconds. */
function expectFrames(found: readonly Buffer[], expected: readonly Buffer[]): void {
  expect(found.map((frame) => frame.length)).toEqual(expected.map((frame) => frame.length));
  expect(found.map((frame, i) => frame.equals(expected[i]!))).toEqual(expected.map(() => true));
}

const status = (pc_online: boolean) => ({ type: 'bridge.status', pc_online });

describe('token', () => {
  it.each([
    '/client',
    '/client?token=',
    '/client?token=wrong',
    `/client?key=${CLIENT_TOKEN}`,
    `/client?token=${HUB_TOKEN}`,
  ])('refuses %s', async (path) => {
    const socket = await new TestSocket(bridge.port, path).open();
    expect((await socket.closed).code).toBe(CLOSE_BAD_TOKEN);
    expect(socket.received).toEqual([]);
  });

  it('does not relay to, or take commands from, a refused client', async () => {
    const companion = await connectCompanion(bridge);
    const refused = await new TestSocket(bridge.port, '/client?token=wrong').open();
    refused.send({ type: 'speedtest' });
    companion.send({ type: 'stats', cpu: 1 });
    await refused.closed;
    await companion.flush();
    expect(refused.received).toEqual([]);
    expect(companion.received).toEqual([]);
  });
});

describe('origin', () => {
  const tryOrigin = async (origin: string) => {
    const socket = await connectClient(bridge, { origin });
    const result = await Promise.race([socket.next(), socket.closed]);
    socket.ws.terminate();
    return result;
  };

  it('allows the bridge, the Vite dev server, localhost and CLIENT_ORIGINS', async () => {
    const hosts = ['localhost', '127.0.0.1', ...lanAddresses(), hostname().toLowerCase()];
    const origins = hosts.flatMap((h) => [`http://${h}:${bridge.port}`, `http://${h}:5173`]);
    for (const origin of [...origins, 'http://hub.lan:9000']) {
      expect(await tryOrigin(origin), origin).toMatchObject({ type: 'bridge.snapshot' });
    }
  });

  it.each(['http://evil.example', 'http://localhost:3000', 'https://localhost:5173', 'http://hub.lan', 'null'])(
    'refuses %s, even with the right token',
    async (origin) => {
      expect(await tryOrigin(origin)).toMatchObject({ code: CLOSE_BAD_ORIGIN });
    },
  );

  it('refuses a foreign origin that matches the Host header (DNS rebinding)', async () => {
    const socket = await connectClient(bridge, {
      origin: `http://evil.example:${bridge.port}`,
      headers: { Host: `evil.example:${bridge.port}` },
    });
    expect((await socket.closed).code).toBe(CLOSE_BAD_ORIGIN);
  });
});

describe('snapshot', () => {
  it('is empty and offline without a companion', async () => {
    const client = await connectClient(bridge);
    expect(await client.next()).toEqual({ type: 'bridge.snapshot', pc_online: false, messages: [], weather: null });
  });

  it('has the last message of every type, then live messages follow', async () => {
    const companion = await connectCompanion(bridge);
    companion.send({ type: 'stats', cpu: 1 });
    companion.send({ type: 'alert', id: 'a' });
    companion.send({ type: 'ping' });
    companion.send({ type: 'weather_v9', x: [1] });
    companion.send({ type: 'stats', cpu: 2 });
    companion.send({ type: 'alert', clear: true });
    await companion.flush();

    const client = await connectClient(bridge);
    expect(await client.next()).toEqual({
      type: 'bridge.snapshot',
      pc_online: true,
      messages: [
        { type: 'stats', cpu: 2 },
        { type: 'alert', clear: true },
        { type: 'weather_v9', x: [1] },
      ],
      weather: null,
    });
    companion.send({ type: 'ping' });
    companion.send({ type: 'stats', cpu: 3 });
    expect(await client.next()).toEqual({ type: 'stats', cpu: 3 });
  });

  it('keeps the data while the PC is offline', async () => {
    const companion = await connectCompanion(bridge);
    companion.send({ type: 'stats', cpu: 1 });
    await companion.flush();
    await vi.advanceTimersByTimeAsync(ONLINE_TIMEOUT_MS);
    const client = await connectClient(bridge);
    expect(await client.next()).toEqual({
      type: 'bridge.snapshot',
      pc_online: false,
      messages: [{ type: 'stats', cpu: 1 }],
      weather: null,
    });
  });

  it('has the weather settings', async () => {
    const weather = { latitude: 41.01, longitude: 28.98, city: 'İstanbul', units: 'metric' } as const;
    const other = await startBridge({ weather });
    try {
      expect(await (await connectClient(other)).next()).toMatchObject({ type: 'bridge.snapshot', weather });
    } finally {
      await other.close();
    }
  });
});

describe('ping', () => {
  it('is answered to the one who asked, and goes no further', async () => {
    const companion = await connectCompanion(bridge);
    const [asking, other] = [await connectClient(bridge), await connectClient(bridge)];
    asking.send('{"type":"bridge.ping","id":7}');
    expect(await asking.until((m) => m.type === 'bridge.pong')).toEqual({ type: 'bridge.pong', id: 7 });
    await asking.flush();
    await companion.flush();
    await other.flush();
    expect(other.received.some((text) => text.includes('pong'))).toBe(false);
    expect(companion.received.some((text) => text.includes('ping'))).toBe(false);
  });

  it.each([
    '{"type":"bridge.ping"}',
    '{"type":"bridge.ping","id":"7"}',
    '{"type":"bridge.ping","id":-1}',
    '{"type":"bridge.ping","id":7,"more":1}',
    '{"type":"bridge.pong","id":7}',
    '{"type":"bridge.snapshot"}',
  ])('is refused as %s', async (text) => {
    const companion = await connectCompanion(bridge);
    const client = await connectClient(bridge);
    client.send(text);
    await client.flush();
    await companion.flush();
    expect(client.received.some((m) => m.includes('pong'))).toBe(false);
    expect(companion.received).toEqual([]);
  });
});

describe('covers', () => {
  it('are relayed unchanged', async () => {
    const companion = await connectCompanion(bridge);
    const client = await connectClient(bridge);
    const frames = [artFrame('ART1', 0, 280, 280), artFrame('ARS1', 0, 320, 320)];
    for (const frame of frames) companion.send(frame);
    await companion.flush();
    await client.flush();
    expectFrames(client.binary, frames);
  });

  it('follow the snapshot, the last of each kind, also while the PC is offline', async () => {
    const companion = await connectCompanion(bridge);
    const [old, latest, server] = [artFrame('ART1'), artFrame('ART1', 0, 8, 2), artFrame('ARS1')];
    for (const frame of [old, server, latest]) companion.send(frame);
    await companion.flush();
    await vi.advanceTimersByTimeAsync(ONLINE_TIMEOUT_MS);
    const client = await connectClient(bridge);
    expect(await client.next()).toMatchObject({ type: 'bridge.snapshot', pc_online: false });
    await client.flush();
    expect(client.binary).toEqual([latest, server]);
  });

  it.each([
    ['ART1 wider than 320', artFrame('ART1', 0, 321, 1)],
    ['ART1 taller than 320', artFrame('ART1', 0, 1, 321)],
    ['ARS1 wider than 320', artFrame('ARS1', 0, 321, 320)],
    ['ARS1 taller than 320', artFrame('ARS1', 0, 320, 321)],
    ['a frame with trailing bytes', artFrame('ART1', 1)],
    ['STM1 wider than 400', steamFrame(1, 0, 401, 1)],
    ['STM1 taller than 240', steamFrame(1, 2, 1, 241)],
    ['STM1 of a kind nobody knows', steamFrame(1, 3)],
    ['STM1 with trailing bytes', artFrame('STM1', 1)],
  ])('leave out %s', async (_name, frame) => {
    const companion = await connectCompanion(bridge);
    const client = await connectClient(bridge);
    companion.send(frame);
    await companion.flush();
    await client.flush();
    expect(client.binary).toEqual([]);
    expect(bridge.hub.covers).toEqual([]);
  });

  it('of games are relayed, and follow the snapshot with a portrait per game', async () => {
    const companion = await connectCompanion(bridge);
    const early = await connectClient(bridge);
    const [oldHeader, header, thumb] = [steamFrame(1, 0), steamFrame(2, 0, 340, 159), steamFrame(2, 1, 64, 96)];
    const portraits = [10, 11, 12].map((id) => steamFrame(id, 2, 96, 144));
    const again = steamFrame(11, 2, 8, 12);
    const all = [oldHeader, header, thumb, ...portraits, again];
    for (const frame of all) companion.send(frame);
    await companion.flush();
    await early.flush();
    expectFrames(early.binary, all);

    const late = await connectClient(bridge);
    await late.flush();
    expectFrames(late.binary, [header, thumb, portraits[0]!, portraits[2]!, again]);
  });

  it('of games that are no longer recent make room', async () => {
    const companion = await connectCompanion(bridge);
    const recent = (...ids: number[]) => companion.send({ type: 'steam', recent: ids.map((appid) => ({ appid })) });
    const portrait = (id: number) => steamFrame(id, 2);
    const ids = () => bridge.hub.covers.map((frame) => frame.readUInt32LE(4));
    recent(1, 2, 3, 4, 5);
    for (const id of [1, 2, 3, 4, 5]) companion.send(portrait(id));
    await companion.flush();
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
    recent(6, 1, 2, 4, 5);
    companion.send(portrait(6));
    await companion.flush();
    expect(ids()).toEqual([1, 2, 4, 5, 6]);
    // A frame before its message: all five are recent, so the oldest goes.
    companion.send(portrait(7));
    await companion.flush();
    expect(ids()).toEqual([2, 4, 5, 6, 7]);
  });

  it('do not go to a refused client, or come from one', async () => {
    const companion = await connectCompanion(bridge);
    const client = await connectClient(bridge);
    companion.send(artFrame('ART1'));
    await companion.flush();
    const refused = await new TestSocket(bridge.port, '/client?token=wrong').open();
    await refused.closed;
    expect(refused.binary).toEqual([]);
    client.send(artFrame('ARS1'));
    await client.flush();
    expect(bridge.hub.covers).toHaveLength(1);
  });
});

describe('live', () => {
  it('relays the exact text, schema mismatches and unknown types included', async () => {
    const companion = await connectCompanion(bridge);
    const client = await connectClient(bridge);
    await client.next();
    const texts = ['{"type":"stats","cpu":"busy", "gpu":null}', '{"type":"media_server","configured":false}'];
    for (const text of texts) companion.send(text);
    await companion.flush();
    await client.flush();
    expect(client.received).toEqual(texts);
  });

  it('reaches every client', async () => {
    const clients = [await connectClient(bridge), await connectClient(bridge)];
    const companion = await connectCompanion(bridge);
    companion.send({ type: 'stats', cpu: 4 });
    for (const client of clients) {
      expect(await client.until((m) => m.type === 'stats')).toEqual({ type: 'stats', cpu: 4 });
    }
  });

  it('tells when the PC goes online and offline', async () => {
    const client = await connectClient(bridge);
    await client.next();
    const companion = await connectCompanion(bridge);
    expect(await client.next()).toEqual(status(true));
    await vi.advanceTimersByTimeAsync(ONLINE_TIMEOUT_MS);
    expect(await client.until((m) => !m.pc_online)).toEqual(status(false));
    companion.send({ type: 'ping' });
    expect(await client.until((m) => m.pc_online)).toEqual(status(true));
    companion.ws.terminate();
    expect(await client.until((m) => !m.pc_online)).toEqual(status(false));
  });

  it('sends a heartbeat every 5 seconds while the PC is offline', async () => {
    const client = await connectClient(bridge);
    await client.next();
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(STATUS_INTERVAL_MS);
      expect(await client.next()).toEqual(status(false));
    }
    // A lost heartbeat must not be enough for a phone to give up on the bridge.
    expect(STATUS_INTERVAL_MS * 2).toBeLessThan(SILENCE_TIMEOUT_MS);
  });

  it('sends the heartbeat while the PC is online too', async () => {
    const client = await connectClient(bridge);
    await client.next();
    const companion = await connectCompanion(bridge);
    await client.next();
    await vi.advanceTimersByTimeAsync(STATUS_INTERVAL_MS - 1);
    companion.send({ type: 'ping' });
    await companion.flush();
    await vi.advanceTimersByTimeAsync(1);
    expect(await client.next()).toEqual(status(true));
  });
});

describe('commands', () => {
  it('passes whitelisted commands on, without extra fields', async () => {
    const companion = await connectCompanion(bridge);
    const client = await connectClient(bridge);
    const commands = [
      { type: 'media', cmd: 'toggle', value: 0 },
      { type: 'media_server', cmd: 'seek', value: 30 },
      { type: 'shortcut', id: 3 },
      { type: 'steam_launch', appid: 730 },
      { type: 'speedtest' },
      { type: 'alert_action', id: 'abc', action: 'dismiss' },
    ];
    for (const command of commands) client.send({ ...command, token: 'x' });
    for (const command of commands) expect(await companion.next()).toEqual(command);
  });

  it.each([
    ['a companion message', { type: 'stats', cpu: 1 }],
    ['hello', { type: 'hello', token: HUB_TOKEN }],
    ['a tile that cannot exist', { type: 'shortcut', id: 16 }],
    ['bad json', 'nope'],
    ['binary', Buffer.from('{"type":"speedtest"}')],
  ])('refuses %s and stays connected', async (_name, message) => {
    const companion = await connectCompanion(bridge);
    const client = await connectClient(bridge);
    client.send(message);
    client.send({ type: 'shortcut', id: 1 });
    expect(await companion.next()).toEqual({ type: 'shortcut', id: 1 });
    expect(bridge.hub.messages).toEqual([]);
  });

  it('drops commands without a companion instead of queueing them', async () => {
    const client = await connectClient(bridge);
    client.send({ type: 'shortcut', id: 1 });
    await client.flush();
    const companion = await connectCompanion(bridge);
    await companion.flush();
    expect(companion.received).toEqual([]);
  });

  it('closes on oversized frames', async () => {
    const client = await connectClient(bridge);
    client.send('x'.repeat(4097));
    expect((await client.closed).code).toBe(1009);
  });
});

describe("the bridge's own features", () => {
  it('send their messages after the snapshot, hear about the opening, and take their commands', async () => {
    await bridge.close();
    const commands: unknown[] = [];
    let opened = 0;
    bridge = await startBridge({
      services: {
        messages: () => [JSON.stringify({ type: 'bridge.bulletin', state: 'off' })],
        opened: () => opened++,
        command: (command, reply) => {
          commands.push(command);
          if (command.type === 'bridge.measurements.get')
            reply(JSON.stringify({ type: 'bridge.measurements', id: 'x', fields: [], entries: [] }));
        },
      },
    });
    const companion = await connectCompanion(bridge);
    const phone = await connectClient(bridge);
    expect((await phone.next()).type).toBe('bridge.snapshot');
    expect(await phone.next()).toEqual({ type: 'bridge.bulletin', state: 'off' });
    expect(opened).toBe(1);

    phone.send({ type: 'bridge.measurements.get', id: 'olcum' });
    expect((await phone.next()).type).toBe('bridge.measurements');
    expect(commands).toEqual([{ type: 'bridge.measurements.get', id: 'olcum' }]);

    // Not on the list: neither the bridge's nor the companion's.
    phone.send({ type: 'bridge.bulletin.run', extra: 1 });
    phone.send({ type: 'bridge.reminder.save', id: 'x', values: { kg: 1 } });
    await phone.flush();
    expect(commands).toHaveLength(2);
    expect(companion.received).toEqual([]);

    bridge.clients.broadcast('{"type":"bridge.reminders","reminders":[]}');
    expect((await phone.next()).type).toBe('bridge.reminders');
  });
});

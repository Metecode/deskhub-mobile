import { ONLINE_TIMEOUT_MS, parseArtFrame, parseMessage } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { silentLogger } from './log.js';
import { MOCK_ONLINE_MS, MOCK_OUTAGE_MS, MOCK_STATS_MS, startMockCompanion } from './mockCompanion.js';
import { createStatsSource, eventsMessage, MockPlayer, SERVER_COVER } from './mockData.js';
import type { Bridge } from './server.js';
import { connectClient, connectCompanion, HUB_TOKEN, startBridge, useFakeTimers } from './testing.js';

let bridge: Bridge;
let stop: () => void;

beforeEach(async () => {
  useFakeTimers();
  bridge = await startBridge();
  stop = startMockCompanion({
    url: `ws://127.0.0.1:${bridge.port}/ws`,
    token: HUB_TOKEN,
    companionConnected: () => bridge.companion.connected,
    log: silentLogger,
  });
});

afterEach(async () => {
  stop();
  await bridge.close();
  vi.useRealTimers();
});

/** The next message of a type. */
const nextMessage = (type = 'stats') =>
  new Promise<any>((resolve) => {
    bridge.hub.on('message', function listen(text) {
      const message = JSON.parse(text);
      if (message.type !== type) return;
      bridge.hub.off('message', listen);
      resolve(message);
    });
  });
const nextStatus = () => new Promise<boolean>((resolve) => bridge.hub.once('status', resolve));

/** Advances a second at a time, giving the sockets a chance to deliver in between. */
async function advance(ms: number): Promise<void> {
  for (let t = 0; t < ms; t += MOCK_STATS_MS) {
    await vi.advanceTimersByTimeAsync(Math.min(MOCK_STATS_MS, ms - t));
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('mock companion', () => {
  it('sends stats through /ws every second', async () => {
    const first = await nextMessage();
    expect(parseMessage(first)).toMatchObject({ kind: 'known', type: 'stats' });
    expect(bridge.hub.online).toBe(true);
    const second = nextMessage();
    await vi.advanceTimersByTimeAsync(MOCK_STATS_MS);
    expect((await second).type).toBe('stats');
  });

  it('sends everything a phone shows, all of it valid', async () => {
    await nextMessage('media_server');
    const types = bridge.hub.messages.map((text) => parseMessage(JSON.parse(text)));
    expect(types.map((m) => m.kind)).toEqual(types.map(() => 'known'));
    expect(types.map((m) => 'type' in m && m.type)).toEqual([
      'layout',
      'home',
      'tiles',
      'tile_state',
      'events',
      'stats',
      'media',
      'media_server',
    ]);
    expect(bridge.hub.covers).toHaveLength(2);
  });

  it('obeys media and shortcut commands', async () => {
    await nextMessage('media_server');
    const client = await connectClient(bridge);
    await client.next();
    const tileState = nextMessage('tile_state');
    client.send({ type: 'shortcut', id: 1 });
    expect((await tileState).on).toEqual([0, 1]);
    const cover = new Promise<Buffer>((resolve) => bridge.hub.once('cover', resolve));
    client.send({ type: 'media', cmd: 'next' });
    expect(parseArtFrame(await cover)).toMatchObject({ magic: 'ART1', id: 2 });
    const media = nextMessage('media');
    await vi.advanceTimersByTimeAsync(MOCK_STATS_MS);
    expect(await media).toMatchObject({ art_id: 2, playing: true });
  });

  it('goes offline now and then, first by going silent and then by disconnecting', async () => {
    await nextMessage();
    await advance(MOCK_ONLINE_MS - MOCK_STATS_MS);
    expect(bridge.hub.online).toBe(true);

    await advance(MOCK_STATS_MS + ONLINE_TIMEOUT_MS);
    expect(bridge.hub.online).toBe(false);
    expect(bridge.companion.connected).toBe(true);

    const online = nextStatus();
    await advance(MOCK_OUTAGE_MS - ONLINE_TIMEOUT_MS);
    expect(await online).toBe(true);

    const offline = nextStatus();
    await advance(MOCK_ONLINE_MS);
    expect(await offline).toBe(false);
    expect(bridge.companion.connected).toBe(false);

    const back = nextStatus();
    await advance(MOCK_OUTAGE_MS);
    expect(await back).toBe(true);
  });

  it('gives way to a real companion for good', async () => {
    await nextMessage();
    const real = await connectCompanion(bridge);
    await advance(MOCK_ONLINE_MS + MOCK_OUTAGE_MS);
    expect(real.ws.readyState).toBe(real.ws.OPEN);
    real.send({ type: 'stats', cpu: 77 });
    await real.flush();
    expect(bridge.hub.messages).toContain('{"type":"stats","cpu":77}');
  });
});

describe('mock data', () => {
  it('has a player that seeks, pauses and goes around', () => {
    const player = new MockPlayer();
    player.command({ type: 'media', cmd: 'seek', value: 9999 });
    player.command({ type: 'media', cmd: 'toggle', value: 0 });
    expect(player.message()).toMatchObject({ pos: 241, dur: 241, playing: false });
    expect(player.tick()).toBe(false);
    player.command({ type: 'media', cmd: 'toggle', value: 0 });
    expect(player.tick()).toBe(true);
    expect(player.message()).toMatchObject({ pos: 0, art_id: 2 });
    for (let i = 0; i < 2; i++) player.command({ type: 'media', cmd: 'prev', value: 0 });
    expect(player.message().art_id).toBe(3);
    expect(parseArtFrame(player.cover)).toMatchObject({ id: 3, width: 280, height: 280 });
  });

  it('has a poster and events that fit the protocol', () => {
    expect(parseArtFrame(SERVER_COVER)).toMatchObject({ magic: 'ARS1', id: 900 });
    expect(parseMessage(eventsMessage(1_800_000_000)).kind).toBe('known');
  });
});

describe('createStatsSource', () => {
  it('stays within plausible values and the fields the companion sends', () => {
    const sample = createStatsSource();
    for (let i = 0; i < 2000; i++) {
      const m = sample();
      expect(m.cpu).toBeGreaterThanOrEqual(0);
      expect(m.cpu).toBeLessThanOrEqual(100);
      expect(m.gpu).toBeLessThanOrEqual(100);
      expect(m.ram_used).toBeLessThanOrEqual(m.ram_total!);
      expect(m.vram_used).toBeLessThanOrEqual(m.vram_total!);
      expect(m.net_down).toBeGreaterThanOrEqual(0);
      expect(m).not.toHaveProperty('cpu_temp');
    }
  });
});

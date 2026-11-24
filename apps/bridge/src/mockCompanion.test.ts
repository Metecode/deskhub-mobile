import { ONLINE_TIMEOUT_MS, parseMessage } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { silentLogger } from './log.js';
import {
  createStatsSource,
  MOCK_ONLINE_MS,
  MOCK_OUTAGE_MS,
  MOCK_STATS_MS,
  startMockCompanion,
} from './mockCompanion.js';
import type { Bridge } from './server.js';
import { connectCompanion, HUB_TOKEN, startBridge, useFakeTimers } from './testing.js';

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

const nextMessage = () => new Promise<string>((resolve) => bridge.hub.once('message', resolve));
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
    const first = JSON.parse(await nextMessage());
    expect(parseMessage(first)).toMatchObject({ kind: 'known', type: 'stats' });
    expect(bridge.hub.online).toBe(true);
    const second = nextMessage();
    await vi.advanceTimersByTimeAsync(MOCK_STATS_MS);
    expect(JSON.parse(await second).type).toBe('stats');
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
    expect(bridge.hub.messages).toEqual(['{"type":"stats","cpu":77}']);
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

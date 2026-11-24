// A stand-in for the companion: connects to /ws the way the real one does and sends
// realistic stats every second. Now and then it goes away for a while, so the offline
// state gets exercised too.
import { CLOSE_REPLACED, type StatsMessage } from '@deskhub-mobile/protocol';
import { WebSocket } from 'ws';
import type { Logger } from './log.js';

export const MOCK_STATS_MS = 1000;
export const MOCK_ONLINE_MS = 45_000;
/** Longer than ONLINE_TIMEOUT_MS, or going silent wouldn't show. */
export const MOCK_OUTAGE_MS = 10_000;

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

export interface MockOptions {
  url: string;
  token: string;
  /** Whether a companion is connected, to stay away from a real one. */
  companionConnected: () => boolean;
  log: Logger;
}

/** Runs until stopped, or until a real companion takes over. Returns a function that stops it. */
export function startMockCompanion({ url, token, companionConnected, log }: MockOptions): () => void {
  const sample = createStatsSource();
  let ws: WebSocket | null = null;
  let stats: NodeJS.Timeout | undefined;
  let next: NodeJS.Timeout | undefined;
  let outages = 0;
  let stopped = false;

  function stop(): void {
    stopped = true;
    clearInterval(stats);
    clearTimeout(next);
    ws?.close();
  }

  function giveWay(): void {
    log.info('mock: a real companion connected, the mock stops');
    stop();
  }

  function connect(): void {
    if (companionConnected()) return giveWay();
    const socket = new WebSocket(url);
    ws = socket;
    socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', token })));
    socket.on('message', (data) => {
      const text = String(data);
      if (JSON.parse(text).type !== 'hello_ok') return log.info(`mock: got command ${text}`);
      log.info('mock: online');
      goOnline();
    });
    socket.on('error', (e) => log.warn(`mock: ${e.message}`));
    socket.on('close', (code) => {
      if (socket !== ws || stopped) return;
      if (code === CLOSE_REPLACED) return giveWay();
      log.warn(`mock: connection closed (${code}), trying again`);
      clearInterval(stats);
      clearTimeout(next);
      next = setTimeout(connect, 2000);
    });
  }

  function goOnline(): void {
    const send = () => ws?.send(JSON.stringify(sample()));
    send();
    clearInterval(stats);
    stats = setInterval(send, MOCK_STATS_MS);
    next = setTimeout(goAway, MOCK_ONLINE_MS);
  }

  function goAway(): void {
    clearInterval(stats);
    const silent = outages++ % 2 === 0;
    log.info(`mock: offline for ${MOCK_OUTAGE_MS / 1000} s (${silent ? 'silent' : 'disconnected'})`);
    if (silent) {
      next = setTimeout(goOnline, MOCK_OUTAGE_MS);
    } else {
      const old = ws;
      ws = null;
      old?.close();
      next = setTimeout(connect, MOCK_OUTAGE_MS);
    }
  }

  connect();
  return stop;
}

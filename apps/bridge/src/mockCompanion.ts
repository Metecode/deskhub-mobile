// A stand-in for the companion: connects to /ws the way the real one does, sends made-up
// data and obeys media and shortcut commands. Now and then it goes away for a while, so
// the offline state gets exercised too.
import { CLOSE_REPLACED, parseCommand, type Command } from '@deskhub-mobile/protocol';
import { WebSocket } from 'ws';
import type { Logger } from './log.js';
import {
  createStatsSource,
  eventsMessage,
  HOME,
  LAYOUT,
  MockPlayer,
  MockTiles,
  SERVER_COVER,
  serverMessage,
  TILES,
} from './mockData.js';

export const MOCK_STATS_MS = 1000;
export const MOCK_ONLINE_MS = 45_000;
/** Longer than ONLINE_TIMEOUT_MS, or going silent wouldn't show. */
export const MOCK_OUTAGE_MS = 10_000;

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
  const player = new MockPlayer();
  const tiles = new MockTiles();
  let ws: WebSocket | null = null;
  let ticks = 0;
  let ticker: NodeJS.Timeout | undefined;
  let next: NodeJS.Timeout | undefined;
  let outages = 0;
  let stopped = false;

  function send(message: object | Buffer): void {
    ws?.send(Buffer.isBuffer(message) ? message : JSON.stringify(message));
  }

  function stop(): void {
    stopped = true;
    clearInterval(ticker);
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
      const command = parseCommand(text);
      if (command) return onCommand(command, text);
      if (JSON.parse(text).type !== 'hello_ok') return;
      log.info('mock: online');
      // In the order of Companion.session().
      for (const message of [LAYOUT, HOME, TILES, tiles.message(), eventsMessage(Math.floor(Date.now() / 1000))])
        send(message);
      send(SERVER_COVER);
      send(player.cover);
      goOnline();
    });
    socket.on('error', (e) => log.warn(`mock: ${e.message}`));
    socket.on('close', (code) => {
      if (socket !== ws || stopped) return;
      if (code === CLOSE_REPLACED) return giveWay();
      log.warn(`mock: connection closed (${code}), trying again`);
      clearInterval(ticker);
      clearTimeout(next);
      next = setTimeout(connect, 2000);
    });
  }

  function onCommand(command: Command, text: string): void {
    log.info(`mock: got command ${text}`);
    if (command.type === 'media' && player.command(command)) send(player.cover);
    if (command.type === 'shortcut' && tiles.tap(command.id)) send(tiles.message());
  }

  function tick(): void {
    ticks++;
    if (player.tick()) send(player.cover);
    for (const message of [sample(), player.message(), serverMessage(ticks)]) send(message);
  }

  function goOnline(): void {
    tick();
    clearInterval(ticker);
    ticker = setInterval(tick, MOCK_STATS_MS);
    next = setTimeout(goAway, MOCK_ONLINE_MS);
  }

  function goAway(): void {
    clearInterval(ticker);
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

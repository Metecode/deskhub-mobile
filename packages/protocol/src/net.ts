// The internet connection, measured on the PC. Source: on_net in firmware/main/hub_server.c.
import type { RawMessage } from './companion.js';
import { bool, fields, int, isObject, list, num, text } from './fields.js';
import { NET_HISTORY } from './limits.js';

export interface Net {
  online: boolean;
  /** ms, null when unknown. */
  latency: number | null;
  /** ms */
  jitter: number;
  /** % */
  loss: number;
  /** ms per probe, oldest first, one every 2 seconds. null: lost. */
  history: readonly (number | null)[];
  /** Epoch seconds, 0 when unknown. */
  upSince: number;
  /** The last outage. null: none seen. */
  lastDrop: { at: number; seconds: number } | null;
  todayBytes: number;
  monthBytes: number;
  /** The last speed test, in Mbps and ms. null: none yet. */
  speed: { down: number; up: number; ping: number; at: number } | null;
  /** A speed test is running. */
  testing: boolean;
  /** "" unless the companion is set up to show it. */
  ip: string;
}

export function normalizeNet(raw: RawMessage): Net {
  const latency = num(raw, 'latency_ms', -1);
  const drop = fields(raw.last_drop);
  const dropAt = int(drop, 'at');
  const speed = fields(raw.speed);
  return {
    online: bool(raw, 'online'),
    latency: latency >= 0 ? latency : null,
    jitter: num(raw, 'jitter_ms'),
    loss: int(raw, 'loss_pct'),
    history: list(raw, 'hist')
      .slice(0, NET_HISTORY)
      .map((v) => (typeof v === 'number' && Math.trunc(v) >= 0 ? Math.trunc(v) : null)),
    upSince: int(raw, 'up_since'),
    lastDrop: dropAt > 0 ? { at: dropAt, seconds: int(drop, 'dur_s') } : null,
    todayBytes: num(raw, 'today_bytes'),
    monthBytes: num(raw, 'month_bytes'),
    speed: isObject(raw.speed)
      ? {
          down: num(speed, 'down_mbps'),
          up: num(speed, 'up_mbps'),
          ping: num(speed, 'ping_ms'),
          at: int(speed, 'at'),
        }
      : null,
    testing: bool(raw, 'testing'),
    ip: text(raw, 'ip'),
  };
}

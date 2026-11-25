// Messages between the bridge and phones. Companion messages are relayed as they
// are; the bridge's own messages have a "bridge." prefix so the two never collide.
import type { RawMessage } from './companion.js';

export type WeatherUnits = 'metric' | 'imperial';

export interface WeatherSettings {
  latitude: number;
  longitude: number;
  /** Shown on the Weather page. May be "". */
  city: string;
  units: WeatherUnits;
}

/**
 * The first message: the latest message of every type so far. Binary ART1 and ARS1
 * frames with the latest covers follow it, if there are any.
 */
export interface SnapshotMessage {
  type: 'bridge.snapshot';
  pc_online: boolean;
  messages: RawMessage[];
  /** What to get the weather for; phones fetch it themselves. null: not set. */
  weather: WeatherSettings | null;
  /** The build of the web app that the bridge serves, if there is one. */
  build?: string;
}

/** Sent when the PC goes online or offline, and every STATUS_INTERVAL_MS as a heartbeat. */
export interface StatusMessage {
  type: 'bridge.status';
  pc_online: boolean;
  /** As in the snapshot; it may change. */
  build?: string;
}

export type BridgeMessage = SnapshotMessage | StatusMessage;

/** The heartbeat's interval. It keeps coming while the PC is offline. */
export const STATUS_INTERVAL_MS = 5000;

/** A phone that heard nothing for this long has lost the bridge. Several heartbeats. */
export const SILENCE_TIMEOUT_MS = 15000;

/** /client close code: wrong or missing token. Retrying with the same one is pointless. */
export const CLOSE_BAD_TOKEN = 4401;

/** /client close code: the page's origin isn't on the allowlist. */
export const CLOSE_BAD_ORIGIN = 4403;

/** /ws close code: another companion said hello. */
export const CLOSE_REPLACED = 4001;

/** Query parameter with the token, in the link a phone opens and on /client itself. */
export const TOKEN_PARAM = 'token';

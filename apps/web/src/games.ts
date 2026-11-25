// What the games page and the Home card say (firmware/main/ui_games.c, home_refresh_game in
// ui_home.c). `now` is in epoch seconds.
import type { Steam } from '@deskhub-mobile/protocol';
import { Store } from './store.js';

/** "41 h", "5.0 h", "48 min" */
export function formatPlaytime(minutes: number): string {
  if (minutes >= 600) return `${Math.trunc(minutes / 60)} h`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} h`;
  return `${minutes} min`;
}

const formatSession = (s: number) =>
  s >= 3600 ? `${Math.trunc(s / 3600)}h ${String(Math.trunc(s / 60) % 60).padStart(2, '0')}m` : `${Math.trunc(s / 60)}m`;

export function formatLastPlayed(t: number, now: number): string {
  const d = Math.trunc(now - t);
  if (t <= 0) return '';
  if (d < 3600) return 'Just now';
  if (d < 86_400) return `${Math.trunc(d / 3600)}h ago`;
  if (d < 2 * 86_400) return 'Yesterday';
  if (d < 60 * 86_400) return `${Math.trunc(d / 86_400)} days ago`;
  return `${Math.trunc(d / (30 * 86_400))} months ago`;
}

/** A total only adds something once it is clearly more than this session. */
export const isTotalWorthShowing = (minutes: number, session: number) =>
  minutes > 0 && minutes * 60 >= session + 600;

/** When things were, ms. */
export interface SteamTimes {
  /** The message arrived. */
  steamAt: number;
  /** The PC went offline. null: it is online. */
  offlineSince: number | null;
}

/** Seconds into the session. Unlike the board's, it doesn't go on while the PC is offline. */
export function sessionSeconds(steam: Steam, { steamAt, offlineSince }: SteamTimes, now: number): number {
  if (!steam.playing) return 0;
  const until = offlineSince === null ? now * 1000 : Math.min(now * 1000, offlineSince);
  return steam.playing.session + Math.max(0, Math.trunc((until - steamAt) / 1000));
}

const dots = (...parts: string[]) => parts.filter(Boolean).join('  •  ');

/** Under the name of the game being played. */
export function playingText(steam: Steam, session: number): { time: string; total: string } {
  const friends = steam.friends.length;
  const total = steam.playing?.total ?? 0;
  return {
    time: `Playing for ${formatSession(session)}`,
    total: dots(
      isTotalWorthShowing(total, session) ? `${formatPlaytime(total)} played` : '',
      friends ? `${friends} friend${friends === 1 ? '' : 's'} in game` : '',
    ),
  };
}

const waiting = (online: boolean) => (online ? 'Waiting for the PC' : 'PC offline');

export function idleText(steam: Steam | null, online: boolean): string {
  if (!steam) return waiting(online);
  return steam.found ? 'Start a game, or pick one below' : "Steam isn't installed on the PC";
}

/** The Home card. */
export function homeGame(steam: Steam | null, session: number, online: boolean, now: number) {
  const recent = steam?.recent[0];
  if (steam?.playing) {
    const { name, total } = steam.playing;
    const worth = isTotalWorthShowing(total, session);
    return { caption: 'PLAYING', sub: dots(formatSession(session), worth ? formatPlaytime(total) : ''), name };
  }
  if (recent) {
    const total = recent.total > 0 ? formatPlaytime(recent.total) : '';
    const ago = formatLastPlayed(recent.last, now);
    return { caption: 'RECENT', sub: dots(ago, total), name: recent.name };
  }
  const sub = !steam ? waiting(online) : steam.found ? 'No games played yet' : 'Steam not found';
  return { caption: 'STEAM', sub, name: '' };
}

/** How long no other game can be started from this phone. */
export const LAUNCH_LOCK_MS = 5000;

/** The app id of the game that was just started here, null when others may be. */
export class LaunchStore extends Store<number | null> {
  constructor() {
    super(null);
  }

  /** Calls `send` unless it is locked, and locks. */
  launch(appid: number, send: () => void): void {
    if (this.getState() !== null) return;
    send();
    this.setState(appid);
    setTimeout(() => this.setState(null), LAUNCH_LOCK_MS);
  }
}

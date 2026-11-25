// Games: the one being played and the recent ones, from Steam and elsewhere.
// Source: on_steam in firmware/main/hub_server.c, ui_set_steam_art in ui_games.c.
import type { RawMessage } from './companion.js';
import { bool, fields, int, isObject, list, num, text, type Fields } from './fields.js';
import { STEAM_FRIENDS, STEAM_RECENT } from './limits.js';

export interface Game {
  /** Custom games have ids from 0xC0000000 up. */
  appid: number;
  name: string;
  /** When it was last played, epoch seconds; 0 when unknown. */
  last: number;
  /** Minutes played in all. */
  total: number;
}

export interface Steam {
  /** False: neither Steam nor another game is set up. */
  found: boolean;
  /** `session`: seconds, when the message was sent. */
  playing: (Game & { session: number }) | null;
  /** Newest first. */
  recent: readonly Game[];
  /** Friends in a game. */
  friends: readonly { name: string; game: string }[];
}

const readGame = (g: Fields): Game => ({
  // A uint32 on the board.
  appid: num(g, 'appid') >>> 0,
  name: text(g, 'name'),
  last: int(g, 'last'),
  total: int(g, 'total_min'),
});

export function normalizeSteam(raw: RawMessage): Steam {
  const playing = fields(raw.playing);
  return {
    found: bool(raw, 'found'),
    playing: isObject(raw.playing) ? { ...readGame(playing), session: int(playing, 'session_s') } : null,
    recent: list(raw, 'recent')
      .slice(0, STEAM_RECENT)
      .map((g) => readGame(fields(g))),
    friends: list(raw, 'friends')
      .slice(0, STEAM_FRIENDS)
      .map((item) => {
        const f = fields(item);
        return { name: text(f, 'name'), game: text(f, 'game') };
      }),
  };
}

/** What an STM1 frame shows, by its `kind`. */
export const STEAM_HEADER = 0;
export const STEAM_THUMB = 1;
export const STEAM_PORTRAIT = 2;

/**
 * The portraits after a new one, oldest first: at most as many as there are recent games.
 * When they are full, the oldest of a game that isn't recent goes, else the oldest (there
 * the board would drop the new one).
 */
export function addPortrait<T>(
  portraits: ReadonlyMap<number, T>,
  appid: number,
  portrait: T,
  recent: ReadonlySet<number>,
): Map<number, T> {
  const next = new Map(portraits);
  next.delete(appid);
  if (next.size >= STEAM_RECENT) {
    const ids = [...next.keys()];
    next.delete(ids.find((id) => !recent.has(id)) ?? ids[0]!);
  }
  return next.set(appid, portrait);
}

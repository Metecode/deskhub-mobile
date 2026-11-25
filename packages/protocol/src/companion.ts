// Messages between the companion and the hub.
// Source: firmware/main/hub_server.c (on_text and the on_* functions) and companion/deskhub/.
//
// The schemas are lenient on purpose: the board reads every field with a fallback
// and never rejects a message, so every field is optional and nullable, and unknown
// fields are kept.
import * as z from 'zod';

const num = z.number().nullish();
const str = z.string().nullish();
const flag = z.boolean().nullish();

/** companion -> hub, the first message on a connection. */
export const helloSchema = z.looseObject({
  type: z.literal('hello'),
  token: str,
});
export type HelloMessage = z.infer<typeof helloSchema>;

/** hub -> companion, the answer to a correct hello. */
export const helloOkSchema = z.looseObject({
  type: z.literal('hello_ok'),
  version: str,
});
export type HelloOkMessage = z.infer<typeof helloOkSchema>;

/** companion -> hub. Accepted by the board; the current companion never sends it. */
export const pingSchema = z.looseObject({ type: z.literal('ping') });
export type PingMessage = z.infer<typeof pingSchema>;

/** companion -> hub, once a second. */
export const statsSchema = z.looseObject({
  type: z.literal('stats'),
  /** % */
  cpu: num,
  /** °C. The board reads it, but the current companion doesn't send it. */
  cpu_temp: num,
  /** GB (2^30 bytes) */
  ram_used: num,
  ram_total: num,
  /** %. Left out, with the next three, when there's no NVIDIA GPU. */
  gpu: num,
  /** °C */
  gpu_temp: num,
  /** GB (2^30 bytes) */
  vram_used: num,
  vram_total: num,
  /** KB/s (1024 bytes) */
  net_down: num,
  net_up: num,
  /** % used of the system drive */
  disk: num,
  cpu_name: str,
  gpu_name: str,
});
export type StatsMessage = z.infer<typeof statsSchema>;

const nowPlaying = {
  active: flag,
  playing: flag,
  title: str,
  artist: str,
  album: str,
  source: str,
  /** Seconds. */
  pos: num,
  dur: num,
  can_seek: flag,
  /** False: can't be remote controlled. Left out means it can. */
  controls: flag,
  /** The cover's id, 0 for none. The cover comes before the message. */
  art_id: num,
};

/** companion -> hub, once a second (media.py). */
export const mediaSchema = z.looseObject({ type: z.literal('media'), ...nowPlaying });
export type MediaMessage = z.infer<typeof mediaSchema>;

/** companion -> hub, once a second with a Plex or Jellyfin server (media_server.py), else on connecting. */
export const mediaServerSchema = z.looseObject({
  type: z.literal('media_server'),
  configured: flag,
  online: flag,
  streams: num,
  transcoding: num,
  name: str,
  /** "plex" or "jellyfin" */
  kind: str,
  version: str,
  library: str,
  ...nowPlaying,
});
export type MediaServerMessage = z.infer<typeof mediaServerSchema>;

/** companion -> hub, on connecting and after every calendar refresh (calendar_feed.py). */
export const eventsSchema = z.looseObject({
  type: z.literal('events'),
  events: z
    .array(
      z.looseObject({
        title: str,
        loc: str,
        cal: str,
        /** Epoch seconds. */
        start: num,
        end: num,
        all_day: flag,
        /** "#rrggbb" */
        color: str,
      }),
    )
    .nullish(),
  /** How many days ahead it looked. */
  days: num,
});
export type EventsMessage = z.infer<typeof eventsSchema>;

/** companion -> hub, on connecting (shortcuts.py, hub_view). */
export const tilesSchema = z.looseObject({
  type: z.literal('tiles'),
  tiles: z.array(z.looseObject({ label: str, icon: str, color: str })).nullish(),
});
export type TilesMessage = z.infer<typeof tilesSchema>;

/** companion -> hub, when it changes: the indices of the tiles that are on. */
export const tileStateSchema = z.looseObject({
  type: z.literal('tile_state'),
  on: z.array(z.number()).nullish(),
});
export type TileStateMessage = z.infer<typeof tileStateSchema>;

/** companion -> hub, on connecting (pages.py, layout_message). */
export const layoutSchema = z.looseObject({
  type: z.literal('layout'),
  pages: z.array(z.string()).nullish(),
  /** "pages" is in the navigation bar's order. */
  ordered: flag,
  /** "left", "right" or "bottom" */
  nav: str,
  /** "off", "clock" or "none" */
  pc_sleep: str,
  /** Minutes after midnight, -1: off. */
  night_start: num,
  night_end: num,
  /** "off" or "clock" */
  night_style: str,
});
export type LayoutMessage = z.infer<typeof layoutSchema>;

/** companion -> hub, on connecting (pages.py, home_message). */
export const homeSchema = z.looseObject({
  type: z.literal('home'),
  header: flag,
  /** Cells of the 5 x 3 grid. */
  grid: z.array(z.looseObject({ widget: str, x: num, y: num, w: num, h: num })).nullish(),
  /** The same as two columns, for boards from before the grid. */
  left: z.array(z.string()).nullish(),
  right: z.array(z.string()).nullish(),
});
export type HomeMessage = z.infer<typeof homeSchema>;

const schemas = {
  hello: helloSchema,
  hello_ok: helloOkSchema,
  ping: pingSchema,
  stats: statsSchema,
  media: mediaSchema,
  media_server: mediaServerSchema,
  events: eventsSchema,
  tiles: tilesSchema,
  tile_state: tileStateSchema,
  layout: layoutSchema,
  home: homeSchema,
} as const;

/** Types the board handles that don't have a schema yet. They parse as "unknown". */
export const TYPES_WITHOUT_SCHEMA: ReadonlySet<string> = new Set([
  'ai',
  'claude',
  'printer',
  'pc_power',
  'alert',
  'steam',
  'net',
  'github',
]);

export type KnownMessage =
  | HelloMessage
  | HelloOkMessage
  | PingMessage
  | StatsMessage
  | MediaMessage
  | MediaServerMessage
  | EventsMessage
  | TilesMessage
  | TileStateMessage
  | LayoutMessage
  | HomeMessage;
export type RawMessage = { type: string; [key: string]: unknown };

export type ParsedMessage =
  | { kind: 'known'; type: KnownMessage['type']; message: KnownMessage; raw: RawMessage }
  /** A type without a schema, or no usable type at all (type is then ""). */
  | { kind: 'unknown'; type: string; raw: RawMessage }
  /** A type with a schema that the message doesn't fit. */
  | { kind: 'mismatch'; type: KnownMessage['type']; raw: RawMessage; issues: string }
  /** Not JSON. The only kind that isn't worth keeping. */
  | { kind: 'invalid' };

/** Parses the text of a companion message. Never throws. */
export function parseCompanionMessage(text: string): ParsedMessage {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'invalid' };
  }
  return parseMessage(value);
}

/** Like parseCompanionMessage, for a message already decoded from JSON. */
export function parseMessage(value: unknown): ParsedMessage {
  const object = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
  const type = 'type' in object && typeof object.type === 'string' ? object.type : '';
  const raw: RawMessage = { ...object, type };
  if (!Object.hasOwn(schemas, type)) return { kind: 'unknown', type, raw };

  const known = type as keyof typeof schemas;
  const result = schemas[known].safeParse(raw);
  return result.success
    ? { kind: 'known', type: known, message: result.data, raw }
    : { kind: 'mismatch', type: known, raw, issues: z.prettifyError(result.error) };
}

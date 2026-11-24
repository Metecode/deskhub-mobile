// Messages between the companion and the hub.
// Source: firmware/main/hub_server.c (on_text, on_stats) and companion/deskhub/stats.py.
//
// The schemas are lenient on purpose: the board reads every field with a fallback
// and never rejects a message, so every field is optional and nullable, and unknown
// fields are kept.
import * as z from 'zod';

const num = z.number().nullish();
const str = z.string().nullish();

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

const schemas = {
  hello: helloSchema,
  hello_ok: helloOkSchema,
  ping: pingSchema,
  stats: statsSchema,
} as const;

/** Types the board handles that don't have a schema yet. They parse as "unknown". */
export const TYPES_WITHOUT_SCHEMA: ReadonlySet<string> = new Set([
  'media',
  'media_server',
  'events',
  'tiles',
  'ai',
  'claude',
  'printer',
  'layout',
  'pc_power',
  'home',
  'alert',
  'tile_state',
  'steam',
  'net',
  'github',
]);

export type KnownMessage = HelloMessage | HelloOkMessage | PingMessage | StatsMessage;
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

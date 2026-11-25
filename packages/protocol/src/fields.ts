// How the board reads fields: a missing or mistyped one gets a default
// (firmware/main/hub_server.c, get_num, get_bool, copy_str, get_color). No Zod here,
// so that the web app doesn't have to carry it.

export type Fields = Readonly<Record<string, unknown>>;

export const isObject = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The fields of a JSON value; none when it isn't an object. */
export function fields(value: unknown): Fields {
  return isObject(value) ? value : {};
}

export function list(o: Fields, key: string): readonly unknown[] {
  const v = o[key];
  return Array.isArray(v) ? v : [];
}

export function num(o: Fields, key: string, fallback = 0): number {
  const v = o[key];
  return typeof v === 'number' ? v : fallback;
}

/** A number the board casts to int. */
export function int(o: Fields, key: string, fallback = 0): number {
  return Math.trunc(num(o, key, fallback));
}

/** Only `true` counts. */
export function bool(o: Fields, key: string): boolean {
  return o[key] === true;
}

export function text(o: Fields, key: string): string {
  const v = o[key];
  return typeof v === 'string' ? v : '';
}

/** "#rrggbb". Never anything else, so it is safe to use in a style. */
export function color(o: Fields, key: string, fallback: string): string {
  const v = o[key];
  if (typeof v !== 'string' || !v.startsWith('#')) return fallback;
  // strtoul() stops at the first character that isn't a digit, and gives 0 for none.
  const digits = /^[0-9a-f]{0,6}/i.exec(v.slice(1))?.[0];
  const rgb = digits ? Number.parseInt(digits, 16) : 0;
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

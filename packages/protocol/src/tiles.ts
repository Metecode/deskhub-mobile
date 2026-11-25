// Shortcut tiles. Source: on_tiles and on_tile_state in firmware/main/hub_server.c.
import type { RawMessage } from './companion.js';
import { color, fields, list, text } from './fields.js';
import { MAX_TILES } from './limits.js';

/** How a tile looks. What it does stays on the PC; a tap only sends its index. */
export interface Tile {
  /** "#rrggbb" */
  color: string;
  label: string;
  /** A name from HUB_ICONS in firmware/main/icons.h. */
  icon: string;
}

export function normalizeTiles(raw: RawMessage): Tile[] {
  return list(raw, 'tiles')
    .slice(0, MAX_TILES)
    .map((item) => {
      const t = fields(item);
      return { color: color(t, 'color', '#2a2f3a'), label: text(t, 'label'), icon: text(t, 'icon') };
    });
}

/** The indices of the tiles that are on. */
export function normalizeTileState(raw: RawMessage): ReadonlySet<number> {
  return new Set(
    list(raw, 'on')
      .filter((i) => typeof i === 'number')
      .map((i) => Math.trunc(i))
      .filter((i) => i >= 0 && i < MAX_TILES),
  );
}

// The Home screen: widgets on a grid of 5 columns by 3 rows.
// Source: on_home in firmware/main/hub_server.c, place_grid and widget_enabled in
// ui_home.c; columns_to_grid in companion/deskhub/pages.py.
import type { RawMessage } from './companion.js';
import { bool, fields, int, list, text } from './fields.js';
import type { Page } from './layout.js';

export const GRID_COLS = 5;
export const GRID_ROWS = 3;

/** In the order of W_NAMES in ui_home.c. */
export const WIDGETS = [
  'clock',
  'claude',
  'events',
  'weather',
  'media',
  'stats',
  'printer',
  'game',
  'net',
  'github',
] as const;
export type Widget = (typeof WIDGETS)[number];

/** The page a widget opens, and is hidden with (W_PAGE in ui_home.c). */
export const WIDGET_PAGES: Readonly<Record<Widget, Page | null>> = {
  clock: null,
  claude: 'ai',
  events: 'calendar',
  weather: 'weather',
  media: 'media',
  stats: 'stats',
  printer: 'printer',
  game: 'games',
  net: 'network',
  github: 'github',
};

export interface GridItem {
  widget: Widget;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Home {
  /** Time and date in a bar across the top, instead of the clock widget. */
  header: boolean;
  grid: readonly GridItem[];
}

const isWidget = (value: unknown): value is Widget => WIDGETS.includes(value as Widget);

/**
 * The two columns of older companions on the grid: the left one 3 cells wide, the
 * right one 2, a row per widget, with Up next taking the rest of its column.
 */
export function columnsToGrid(left: readonly Widget[], right: readonly Widget[]): GridItem[] {
  const grid: GridItem[] = [];
  const columns = [
    { x: 0, w: 3, widgets: left },
    { x: 3, w: 2, widgets: right },
  ];
  for (const { x, w, widgets } of columns) {
    let y = 0;
    for (const [i, widget] of widgets.entries()) {
      if (y >= GRID_ROWS) break;
      // Every widget comes 2 and 3 cells wide, and only Up next takes the rest (HOME_SIZES).
      const h = widget === 'events' && i === widgets.length - 1 ? GRID_ROWS - y : 1;
      grid.push({ widget, x, y, w, h });
      y += h;
    }
  }
  return grid;
}

/** Until the companion says otherwise (home_columns in pages.py, s_spec in ui_home.c). */
export const DEFAULT_HOME: Home = {
  header: true,
  grid: columnsToGrid(['claude', 'events'], ['weather', 'media', 'stats']),
};

/** Clamps to the grid, and drops unknown widgets, repeats and empty ones, as place_grid does. */
function readGrid(items: readonly unknown[]): GridItem[] {
  const grid: GridItem[] = [];
  for (const item of items) {
    const o = fields(item);
    const widget = text(o, 'widget');
    if (!isWidget(widget) || grid.some((g) => g.widget === widget)) continue;
    const x = Math.max(0, int(o, 'x'));
    const y = Math.max(0, int(o, 'y'));
    const w = Math.min(int(o, 'w', 1), GRID_COLS - x);
    const h = Math.min(int(o, 'h', 1), GRID_ROWS - y);
    if (w > 0 && h > 0) grid.push({ widget, x, y, w, h });
  }
  return grid;
}

export function normalizeHome(raw: RawMessage): Home {
  const header = bool(raw, 'header');
  if (Array.isArray(raw.grid)) return { header, grid: readGrid(raw.grid) };
  const left = [...new Set(list(raw, 'left').filter(isWidget))];
  const right = [...new Set(list(raw, 'right').filter(isWidget))].filter((w) => !left.includes(w));
  return { header, grid: columnsToGrid(left, right) };
}

/** The widgets to show: not those whose page is off, and no clock next to the top bar. */
export function visibleWidgets(home: Home, pages: readonly Page[]): GridItem[] {
  return home.grid.filter(({ widget }) => {
    if (widget === 'clock') return !home.header;
    const page = WIDGET_PAGES[widget];
    return page === null || pages.includes(page);
  });
}

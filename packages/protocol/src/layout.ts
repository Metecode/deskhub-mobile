// Which pages there are, in which order, where the navigation bar goes, and when the
// screen goes dark.
// Source: on_layout in firmware/main/hub_server.c; ui_set_layout, ui_set_page_order,
// merge_order and ui_set_nav in ui.c; display_set_night in display.c.
import type { RawMessage } from './companion.js';
import { bool, int, list, text } from './fields.js';

/** In the order of PAGE_* in ui_internal.h. */
export const PAGES = [
  'home',
  'stats',
  'ai',
  'calendar',
  'weather',
  'media',
  'printer',
  'shortcuts',
  'timer',
  'games',
  'network',
  'github',
] as const;
export type Page = (typeof PAGES)[number];

export type Nav = 'left' | 'right' | 'bottom';

/** How the screen is dark: black, or a dim clock. */
export type DarkStyle = 'off' | 'clock';

export interface Night {
  /** Minutes after midnight, -1: no night mode. */
  start: number;
  end: number;
  style: DarkStyle;
}

export interface Layout {
  /** The enabled pages in the bar's order. Home always, and first. */
  pages: readonly Page[];
  nav: Nav;
  /** What to do while the PC's display sleeps. */
  pcSleep: DarkStyle | 'none';
  night: Night;
}

/** Shortcuts goes last, by the status icons (default_order in ui.c). */
const DEFAULT_ORDER: readonly Page[] = [...PAGES.filter((p) => p !== 'shortcuts'), 'shortcuts'];

/** Until the companion says otherwise (g_pages_mask in ui.c, nav_position in pages.py). */
export const DEFAULT_LAYOUT: Layout = {
  pages: DEFAULT_ORDER.filter((p) => p !== 'printer' && p !== 'github'),
  nav: 'left',
  pcSleep: 'off',
  night: { start: -1, end: -1, style: 'off' },
};

const isPage = (value: unknown): value is Page => PAGES.includes(value as Page);
const isNav = (value: string): value is Nav => value === 'left' || value === 'right' || value === 'bottom';
const isPcSleep = (value: string): value is Layout['pcSleep'] =>
  value === 'off' || value === 'clock' || value === 'none';
const isMinute = (value: number): boolean => value >= -1 && value < 24 * 60;

function applyNight(previous: Night, raw: RawMessage): Night {
  // Only companions that know about night mode send it.
  if (raw.night_start === undefined) return previous;
  const start = int(raw, 'night_start', -1);
  const end = int(raw, 'night_end', -1);
  if (!isMinute(start) || !isMinute(end)) return previous;
  return { start, end, style: text(raw, 'night_style') === 'clock' ? 'clock' : 'off' };
}

/** The layout after a `layout` message. What it doesn't say stays as in `previous`. */
export function applyLayout(previous: Layout, raw: RawMessage): Layout {
  const listed = new Set<Page>(['home', ...list(raw, 'pages').filter(isPage)]);
  // Older companions sent a fixed order, which the board ignores.
  const order = bool(raw, 'ordered') ? listed : new Set<Page>([...previous.pages, ...DEFAULT_ORDER]);
  const nav = text(raw, 'nav');
  const pcSleep = text(raw, 'pc_sleep');
  return {
    pages: [...order].filter((p) => listed.has(p)),
    nav: isNav(nav) ? nav : previous.nav,
    pcSleep: isPcSleep(pcSleep) ? pcSleep : previous.pcSleep,
    night: applyNight(previous.night, raw),
  };
}

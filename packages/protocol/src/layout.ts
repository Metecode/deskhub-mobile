// Which pages there are, in which order, and where the navigation bar goes.
// Source: on_layout in firmware/main/hub_server.c; ui_set_layout, ui_set_page_order,
// merge_order and ui_set_nav in ui.c.
import type { RawMessage } from './companion.js';
import { bool, list, text } from './fields.js';

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

export interface Layout {
  /** The enabled pages in the bar's order. Home always, and first. */
  pages: readonly Page[];
  nav: Nav;
}

/** Shortcuts goes last, by the status icons (default_order in ui.c). */
const DEFAULT_ORDER: readonly Page[] = [...PAGES.filter((p) => p !== 'shortcuts'), 'shortcuts'];

/** Until the companion says otherwise (g_pages_mask in ui.c, nav_position in pages.py). */
export const DEFAULT_LAYOUT: Layout = {
  pages: DEFAULT_ORDER.filter((p) => p !== 'printer' && p !== 'github'),
  nav: 'left',
};

const isPage = (value: unknown): value is Page => PAGES.includes(value as Page);
const isNav = (value: string): value is Nav => value === 'left' || value === 'right' || value === 'bottom';

/** The layout after a `layout` message. What it doesn't say stays as in `previous`. */
export function applyLayout(previous: Layout, raw: RawMessage): Layout {
  const listed = new Set<Page>(['home', ...list(raw, 'pages').filter(isPage)]);
  // Older companions sent a fixed order, which the board ignores.
  const order = bool(raw, 'ordered') ? listed : new Set<Page>([...previous.pages, ...DEFAULT_ORDER]);
  const nav = text(raw, 'nav');
  return { pages: [...order].filter((p) => listed.has(p)), nav: isNav(nav) ? nav : previous.nav };
}

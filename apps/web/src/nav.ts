// The dock: which pages have a tab, and which are under "All".
import type { Page } from '@deskhub-mobile/protocol';
import type { IconName } from './icons.js';

/** The pages there are to see. The Internet is a view of the stats page (ui_show_page in ui.c). */
export const TABS = {
  home: 'home',
  stats: 'desktop_windows',
  ai: 'auto_awesome',
  calendar: 'event',
  weather: 'wb_sunny',
  media: 'music_note',
  printer: 'view_in_ar',
  timer: 'timer',
  games: 'sports_esports',
  github: 'commit',
  shortcuts: 'grid_view',
} as const satisfies Partial<Record<Page, IconName>>;

export type Tab = keyof typeof TABS;

/** What the stage shows. */
export type View = Tab | 'all';

const isTab = (page: Page): page is Tab => Object.hasOwn(TABS, page);

/** The pages to show, in the companion's order. */
export const tabsOf = (pages: readonly Page[]): Tab[] => pages.filter(isTab);

/** The most that fit with their names. */
export const DOCK_MAX = 6;

export interface Dock {
  tabs: Tab[];
  /** What is under "All". null: everything is in the dock, so there is no "All". */
  rest: Tab[] | null;
}

export function dockOf(pages: readonly Page[]): Dock {
  const tabs = tabsOf(pages);
  if (tabs.length <= DOCK_MAX) return { tabs, rest: null };
  return { tabs: tabs.slice(0, DOCK_MAX - 1), rest: tabs.slice(DOCK_MAX - 1) };
}

/** The view to show: Home when the one asked for is turned off or doesn't exist. */
export function viewToShow(view: Page | 'all', pages: readonly Page[]): View {
  if (view === 'all') return dockOf(pages).rest ? 'all' : 'home';
  return tabsOf(pages).find((tab) => tab === view) ?? 'home';
}

/** The dock's marked entry: pages under "All" belong to it. */
export const markedTab = (view: View, { tabs, rest }: Dock): View =>
  view === 'all' || (rest?.includes(view) && !tabs.includes(view)) ? 'all' : view;

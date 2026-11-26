// The dock: which pages have a tab, and which are under "All".
import type { Page } from '@deskhub-mobile/protocol';
import type { IconName } from './icons.js';

/** The bridge's own pages (phase 6), not the companion's. */
export type OwnPage = 'bulletin';
export type PageName = Page | OwnPage;

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
  bulletin: 'article',
} as const satisfies Partial<Record<PageName, IconName>>;

export type Tab = keyof typeof TABS;

/** What the stage shows. */
export type View = Tab | 'all' | 'tabs' | 'measurements';

const isTab = (page: string): page is Tab => Object.hasOwn(TABS, page);

/** The pages to show, in the companion's order; the bridge's own come right after Home. */
export function tabsOf(pages: readonly Page[], own: readonly OwnPage[] = []): Tab[] {
  const tabs: Tab[] = pages.filter((page): page is Page & Tab => isTab(page));
  const at = tabs.indexOf('home') + 1;
  return [...tabs.slice(0, at), ...own, ...tabs.slice(at)];
}

/** The most that fit with their names. */
export const DOCK_MAX = 6;

export interface Dock {
  tabs: Tab[];
  /** What is under "All". null: everything is in the dock, so there is no "All". */
  rest: Tab[] | null;
}

export function dockOf(tabs: readonly Tab[]): Dock {
  if (tabs.length <= DOCK_MAX) return { tabs: [...tabs], rest: null };
  return { tabs: tabs.slice(0, DOCK_MAX - 1), rest: tabs.slice(DOCK_MAX - 1) };
}

/** The view to show: Home when the one asked for is turned off or doesn't exist. */
export function viewToShow(view: PageName | 'all' | 'tabs' | 'measurements', tabs: readonly Tab[]): View {
  if (view === 'tabs' || view === 'measurements') return view;
  if (view === 'all') return dockOf(tabs).rest ? 'all' : 'home';
  return tabs.find((tab) => tab === view) ?? 'home';
}

/** The dock's marked entry: pages under "All" belong to it. */
export const markedTab = (view: View, { tabs, rest }: Dock): View =>
  view === 'all' || view === 'tabs' || view === 'measurements' || (rest?.includes(view) && !tabs.includes(view)) ? 'all' : view;

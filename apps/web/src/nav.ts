// The navigation bar's pages (s_glyphs and ui_show_page in firmware/main/ui.c).
import type { Page } from '@deskhub-mobile/protocol';
import type { IconName } from './icons.js';

/** The pages with a tab: all but the Internet, which is a view of the stats page. */
export const TABS = {
  home: { icon: 'home', label: 'Home' },
  stats: { icon: 'insights', label: 'PC stats' },
  ai: { icon: 'auto_awesome', label: 'AI usage' },
  calendar: { icon: 'event', label: 'Calendar' },
  weather: { icon: 'wb_sunny', label: 'Weather' },
  media: { icon: 'music_note', label: 'Now playing' },
  printer: { icon: 'view_in_ar', label: '3D printer' },
  timer: { icon: 'timer', label: 'Timer' },
  games: { icon: 'sports_esports', label: 'Games' },
  github: { icon: 'commit', label: 'GitHub' },
  shortcuts: { icon: 'grid_view', label: 'Shortcuts' },
} as const satisfies Partial<Record<Page, { icon: IconName; label: string }>>;

export type Tab = keyof typeof TABS;

const isTab = (page: Page): page is Tab => Object.hasOwn(TABS, page);

/** The tabs to show, in the companion's order. */
export const tabsOf = (pages: readonly Page[]): Tab[] => pages.filter(isTab);

/** The page to show: Home when the one asked for is turned off or doesn't exist. */
export const pageToShow = (page: Page, pages: readonly Page[]): Tab => tabsOf(pages).find((t) => t === page) ?? 'home';

/** The least a tab may be along the bar, CSS pixels. */
export const TAB_MIN = 44;

/**
 * How long a tab is in a bar that has to be scrolled: one more is half in view, so that it
 * shows there is more. null: all `count` fit.
 */
export function scrolledTab(barLength: number, count: number): number | null {
  if (count * TAB_MIN <= barLength) return null;
  return barLength / (Math.max(0, Math.floor(barLength / TAB_MIN - 0.5)) + 0.5);
}

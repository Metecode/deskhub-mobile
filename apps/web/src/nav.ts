// The navigation bar's pages (s_glyphs and ui_show_page in firmware/main/ui.c).
import type { Page } from '@deskhub-mobile/protocol';
import type { IconName } from './icons.js';

/** The pages there are so far. The others get their tab when they are built. */
export const TABS = {
  home: { icon: 'home', label: 'Home' },
  stats: { icon: 'insights', label: 'PC stats' },
  ai: { icon: 'auto_awesome', label: 'AI usage' },
  calendar: { icon: 'event', label: 'Calendar' },
  weather: { icon: 'wb_sunny', label: 'Weather' },
  media: { icon: 'music_note', label: 'Now playing' },
  timer: { icon: 'timer', label: 'Timer' },
  shortcuts: { icon: 'grid_view', label: 'Shortcuts' },
} as const satisfies Partial<Record<Page, { icon: IconName; label: string }>>;

export type Tab = keyof typeof TABS;

const isTab = (page: Page): page is Tab => Object.hasOwn(TABS, page);

/** The tabs to show, in the companion's order. */
export const tabsOf = (pages: readonly Page[]): Tab[] => pages.filter(isTab);

/** The page to show: Home when the one asked for is turned off or doesn't exist. */
export const pageToShow = (page: Page, pages: readonly Page[]): Tab => tabsOf(pages).find((t) => t === page) ?? 'home';

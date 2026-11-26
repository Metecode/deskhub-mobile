// The order of the tabs, when it was changed on this phone. Which pages there are is up to the companion.
import type { Page } from '@deskhub-mobile/protocol';
import { tabsOf, type OwnPage, type Tab } from './nav.js';
import { loadJson, saveJson } from './saved.js';
import { Store } from './store.js';

const KEY = 'deskhub-mobile.tabs';

/** null: the companion's order. */
export type TabOrder = readonly string[] | null;

/** Pages that were added since come last, in the companion's order. */
export function orderTabs(pages: readonly Page[], order: TabOrder, own: readonly OwnPage[] = []): Tab[] {
  const tabs = tabsOf(pages, own);
  if (!order) return tabs;
  const known = [...new Set(order)].flatMap((name) => tabs.filter((tab) => tab === name));
  return [...known, ...tabs.filter((tab) => !known.includes(tab))];
}

export function swapTabs(tabs: readonly Tab[], a: Tab, b: Tab): Tab[] {
  return tabs.map((tab) => (tab === a ? b : tab === b ? a : tab));
}

export class TabOrderStore extends Store<TabOrder> {
  constructor() {
    const saved = loadJson(KEY);
    super(Array.isArray(saved) && saved.every((name) => typeof name === 'string') ? saved : null);
  }

  readonly set = (order: TabOrder): void => {
    saveJson(KEY, order);
    this.setState(order);
  };
}

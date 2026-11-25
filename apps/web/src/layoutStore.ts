// The last layout and Home grid, so the right tabs and widgets are there before (or
// without) the companion. The board keeps them in NVS.
import {
  applyLayout,
  DEFAULT_HOME,
  DEFAULT_LAYOUT,
  normalizeHome,
  type Home,
  type Layout,
} from '@deskhub-mobile/protocol';
import { loadJson, saveJson } from './saved.js';

const KEY = 'deskhub-mobile.layout';

export interface SavedLayout {
  layout: Layout;
  home: Home;
}

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

export function loadLayout(): SavedLayout {
  const saved = loadJson(KEY) as Partial<SavedLayout> | null;
  // What is saved has the fields of the messages, so it is checked like them.
  return {
    layout: isObject(saved?.layout)
      ? applyLayout(DEFAULT_LAYOUT, { ...saved.layout, type: 'layout', ordered: true })
      : DEFAULT_LAYOUT,
    home: isObject(saved?.home) ? normalizeHome({ ...saved.home, type: 'home' }) : DEFAULT_HOME,
  };
}

export function saveLayout({ layout, home }: SavedLayout): void {
  saveJson(KEY, { layout, home });
}

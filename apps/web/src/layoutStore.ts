// The last layout and Home grid, so the right tabs and widgets, and the night, are there
// before (or without) the companion. The board keeps them in NVS.
import {
  applyLayout,
  DEFAULT_HOME,
  DEFAULT_LAYOUT,
  fields,
  isObject,
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

export function loadLayout(): SavedLayout {
  const saved = loadJson(KEY) as Partial<SavedLayout> | null;
  const layout = fields(saved?.layout);
  const night = fields(layout.night);
  // Checked as the messages are.
  return {
    layout: isObject(saved?.layout)
      ? applyLayout(DEFAULT_LAYOUT, {
          ...layout,
          type: 'layout',
          ordered: true,
          pc_sleep: layout.pcSleep,
          night_start: night.start,
          night_end: night.end,
          night_style: night.style,
        })
      : DEFAULT_LAYOUT,
    home: isObject(saved?.home) ? normalizeHome({ ...saved.home, type: 'home' }) : DEFAULT_HOME,
  };
}

export function saveLayout({ layout, home }: SavedLayout): void {
  saveJson(KEY, { layout, home });
}

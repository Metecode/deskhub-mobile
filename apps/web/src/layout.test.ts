import { DEFAULT_HOME, GRID_COLS, GRID_ROWS, PAGES, type GridItem, type Page, type Widget } from '@deskhub-mobile/protocol';
import { describe, expect, it } from 'vitest';
import { homeGrid } from './homeLayout.js';
import { DOCK_MAX, dockOf, markedTab, viewToShow } from './nav.js';

const ALL: readonly Page[] = PAGES;
const FEW: readonly Page[] = ['home', 'ai', 'calendar', 'weather', 'stats', 'network', 'timer'];

describe('the dock', () => {
  it('has the first pages in the order of the companion, and the rest under All', () => {
    const { tabs, rest } = dockOf(['ai', 'home', 'media', 'timer', 'stats', 'weather', 'games', 'network']);
    expect(tabs).toEqual(['ai', 'home', 'media', 'timer', 'stats']);
    expect(rest).toEqual(['weather', 'games']);
  });

  it('never has more than fit, and loses none', () => {
    for (let n = 0; n <= ALL.length; n++) {
      const { tabs, rest } = dockOf(ALL.slice(0, n));
      expect(tabs.length + (rest ? 1 : 0)).toBeLessThanOrEqual(DOCK_MAX);
      expect([...tabs, ...(rest ?? [])]).toEqual(ALL.slice(0, n).filter((p) => p !== 'network'));
    }
  });

  it('has no All when everything fits: the Internet has no tab of its own', () => {
    expect(dockOf(FEW)).toEqual({ tabs: ['home', 'ai', 'calendar', 'weather', 'stats', 'timer'], rest: null });
  });

  it('shows Home for what is not there', () => {
    expect(viewToShow('games', FEW)).toBe('home');
    expect(viewToShow('network', FEW)).toBe('home');
    expect(viewToShow('all', FEW)).toBe('home');
    expect(viewToShow('all', ALL)).toBe('all');
    expect(viewToShow('timer', FEW)).toBe('timer');
  });

  it('marks All for the pages under it', () => {
    const dock = dockOf(ALL);
    expect(markedTab('home', dock)).toBe('home');
    expect(markedTab('github', dock)).toBe('all');
    expect(markedTab('all', dock)).toBe('all');
    expect(markedTab('timer', dockOf(FEW))).toBe('timer');
  });
});

describe('the grid of Home', () => {
  const item = (widget: Widget, x: number, y: number, w: number, h: number): GridItem => ({ widget, x, y, w, h });
  const grid = (...items: GridItem[]) => homeGrid({ header: false, grid: items }, ALL);

  it('gives the room of the weather and the events to their neighbours', () => {
    // claude and events on the left; weather, media and stats on the right
    expect(homeGrid(DEFAULT_HOME, ALL)).toEqual([
      item('claude', 0, 0, 3, 2),
      item('media', 3, 0, 2, 2),
      item('stats', 0, 2, 5, 1),
    ]);
  });

  it('shares it', () => {
    expect(grid(item('claude', 0, 0, 5, 1), item('events', 0, 1, 2, 2), item('net', 2, 1, 3, 2))).toEqual([
      item('claude', 0, 0, 5, 1),
      item('net', 0, 1, 5, 2),
    ]);
    expect(grid(item('stats', 0, 0, 1, 3), item('clock', 1, 0, 2, 3), item('net', 3, 0, 1, 3))).toEqual([
      item('stats', 0, 0, 2, 3),
      item('net', 2, 0, 2, 3),
    ]);
  });

  it('leaves cells alone that the user left empty', () => {
    expect(grid(item('claude', 0, 0, 3, 1), item('weather', 0, 1, 3, 1))).toEqual([item('claude', 0, 0, 3, 2)]);
  });

  it('does not grow into a part of the room only', () => {
    expect(grid(item('claude', 0, 0, 5, 1), item('weather', 0, 1, 2, 1))).toEqual([item('claude', 0, 0, 5, 1)]);
  });

  it('never overlaps what did not, or leaves the grid', () => {
    const items = grid(item('net', 1, 1, 1, 1), item('events', 0, 0, 5, 1), item('weather', 0, 1, 1, 2), item('stats', 4, 2, 1, 1));
    const taken = new Set<number>();
    for (const { x, y, w, h } of items) {
      expect(x + w).toBeLessThanOrEqual(GRID_COLS);
      expect(y + h).toBeLessThanOrEqual(GRID_ROWS);
      for (let row = y; row < y + h; row++)
        for (let col = x; col < x + w; col++) {
          expect(taken.has(row * GRID_COLS + col)).toBe(false);
          taken.add(row * GRID_COLS + col);
        }
    }
  });

  it('is not left empty', () => {
    const items = [item('weather', 0, 0, 2, 1), item('events', 2, 0, 3, 3)];
    expect(grid(...items)).toEqual(items);
  });

  it('changes nothing of what it was given', () => {
    const before = JSON.stringify(DEFAULT_HOME);
    homeGrid(DEFAULT_HOME, ALL);
    expect(JSON.stringify(DEFAULT_HOME)).toBe(before);
  });
});

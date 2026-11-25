import type { Page } from '@deskhub-mobile/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dockOf } from './nav.js';
import { orderTabs, swapTabs, TabOrderStore } from './tabOrder.js';

const PAGES: readonly Page[] = ['home', 'stats', 'network', 'ai', 'calendar', 'media'];

describe('the order of the tabs', () => {
  it("is the companion's by default", () => {
    expect(orderTabs(PAGES, null)).toEqual(['home', 'stats', 'ai', 'calendar', 'media']);
  });

  it('can be changed', () => {
    expect(orderTabs(PAGES, ['media', 'home', 'calendar', 'ai', 'stats'])).toEqual(['media', 'home', 'calendar', 'ai', 'stats']);
  });

  it('has pages that were added last, and none that is gone', () => {
    expect(orderTabs(PAGES, ['media', 'github', 'home'])).toEqual(['media', 'home', 'stats', 'ai', 'calendar']);
    expect(orderTabs(['home'], ['media', 'home'])).toEqual(['home']);
  });

  it('ignores what makes no sense', () => {
    expect(orderTabs(PAGES, ['media', 'media', 'network', 'toString', ''])).toEqual(['media', 'home', 'stats', 'ai', 'calendar']);
    expect(orderTabs(PAGES, [])).toEqual(orderTabs(PAGES, null));
  });

  it('swaps two, and keeps them all', () => {
    const tabs = orderTabs(PAGES, null);
    expect(swapTabs(tabs, 'home', 'media')).toEqual(['media', 'stats', 'ai', 'calendar', 'home']);
    expect(swapTabs(tabs, 'ai', 'ai')).toEqual(tabs);
  });

  it('decides what is in the dock', () => {
    const pages: Page[] = ['home', 'stats', 'ai', 'calendar', 'weather', 'media', 'github'];
    const { tabs, rest } = dockOf(orderTabs(pages, ['github', 'media']));
    expect(tabs).toEqual(['github', 'media', 'home', 'stats', 'ai']);
    expect(rest).toEqual(['calendar', 'weather']);
  });
});

describe('TabOrderStore', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('survives a reload, until it is taken back', () => {
    new TabOrderStore().set(['ai', 'home']);
    expect(new TabOrderStore().getState()).toEqual(['ai', 'home']);
    new TabOrderStore().set(null);
    expect(new TabOrderStore().getState()).toBeNull();
    expect(storage.size).toBe(0);
  });

  it.each(['null', '{}', '5', '[1]', '['])('survives %j in the storage', (text) => {
    storage.set('deskhub-mobile.tabs', text);
    expect(new TabOrderStore().getState()).toBeNull();
  });
});

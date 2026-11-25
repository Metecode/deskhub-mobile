import { describe, expect, it } from 'vitest';
import { needsConfirming, tileColumns } from './shortcuts.js';

describe('shortcuts', () => {
  it('make an even grid', () => {
    expect([1, 4, 5, 6, 7, 8, 9, 10, 12, 16].map(tileColumns)).toEqual([2, 2, 3, 3, 4, 4, 3, 4, 4, 4]);
  });

  it('with the power icon take two touches, the others one', () => {
    expect(['power_settings_new', 'lock', 'terminal', ''].map(needsConfirming)).toEqual([true, false, false, false]);
  });
});

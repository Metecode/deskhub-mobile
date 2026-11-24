import { describe, expect, it } from 'vitest';
import { linePath } from './chart.js';

const at = (s: number, cpu: number, gpu: number | null = null) => ({ t: 1_000_000 + s * 1000, cpu, gpu });

describe('linePath', () => {
  it('ends at the right edge', () => {
    expect(linePath([at(0, 0), at(1, 50), at(2, 100)], (p) => p.cpu)).toBe('M58000 100L59000 50L60000 0');
  });

  it('stays inside the box', () => {
    expect(linePath([at(0, -5), at(1, 130)], (p) => p.cpu)).toBe('M59000 100L60000 0');
  });

  it('leaves a gap where the PC was away', () => {
    expect(linePath([at(0, 10), at(1, 10), at(11, 20), at(12, 20)], (p) => p.cpu)).toBe(
      'M48000 90L49000 90M59000 80L60000 80',
    );
  });

  it('leaves out missing values', () => {
    expect(linePath([at(0, 1, 40), at(1, 1, null), at(2, 1, 60)], (p) => p.gpu)).toBe('M58000 60M60000 40');
    expect(linePath([at(0, 1)], (p) => p.gpu)).toBe('');
  });

  it('is empty without points', () => {
    expect(linePath([], (p) => p.cpu)).toBe('');
  });
});

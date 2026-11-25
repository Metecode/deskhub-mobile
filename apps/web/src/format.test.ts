import { describe, expect, it } from 'vitest';
import { formatMemory, formatPercent, formatRate, formatTemperature } from './format.js';

describe('format', () => {
  it.each([
    [0, '0 KB/s'],
    [220.9, '220 KB/s'],
    [1023.9, '1023 KB/s'],
    [1024, '1,0 MB/s'],
    [1843.2, '1,8 MB/s'],
  ])('rate %d', (kbps, text) => expect(formatRate(kbps)).toBe(text));

  it.each([
    [0, '%0'],
    [29.4, '%29'],
    [29.5, '%30'],
    [100, '%100'],
  ])('percent %d', (pct, text) => expect(formatPercent(pct)).toBe(text));

  it('temperature', () => {
    expect(formatTemperature(52.9)).toBe('52°C');
    expect(formatTemperature(0)).toBe('0°C');
    expect(formatTemperature(null)).toBe('');
  });

  it('memory', () => {
    expect(formatMemory(18.41, 31.9)).toBe('18,4 / 32 GB');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limitWarnings, MAX_WARNINGS, type Logger } from './log.js';

let written: string[];
let log: Logger;

beforeEach(() => {
  vi.useFakeTimers();
  written = [];
  log = limitWarnings({ info: (m) => void written.push(m), warn: (m) => void written.push(m) });
});

afterEach(() => void vi.useRealTimers());

describe('limitWarnings', () => {
  it('leaves warnings out when there are too many, and says how many', () => {
    for (let i = 0; i < MAX_WARNINGS + 5; i++) log.warn('refused');
    expect(written).toHaveLength(MAX_WARNINGS);
    vi.advanceTimersByTime(60_000);
    written.length = 0;
    log.warn('refused again');
    expect(written).toEqual(['5 more warnings were left out', 'refused again']);
  });

  it('goes on when the clock was set back', () => {
    for (let i = 0; i < MAX_WARNINGS; i++) log.warn('refused');
    vi.setSystemTime(Date.now() - 3_600_000);
    log.warn('later');
    expect(written.at(-1)).toBe('later');
  });

  it('takes out control characters and what is too long', () => {
    log.warn('a\x1b[2J\x9b2J\r\tb ğ\nc');
    expect(written).toEqual(['a?[2J?2J??b ğ\nc']);
    log.warn('x'.repeat(16_000));
    expect(written.at(-1)).toHaveLength(500);
  });

  it('leaves the rest alone', () => {
    for (let i = 0; i < 100; i++) log.info('client connected');
    expect(written).toHaveLength(100);
  });
});

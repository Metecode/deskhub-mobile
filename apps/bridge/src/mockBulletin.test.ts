import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBulletin } from './bulletinCheck.js';
import { parsePrompt } from './bulletinPrompt.js';
import { runArgs } from './codex.js';
import { MOCK_RUN_MS, mockCodex, mockSheet } from './mockBulletin.js';
import { makePortfolio, portfolioMaker } from './portfolio.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('mock bulletin', () => {
  it('passes the real checks, with the example prompt, and makes a whole portfolio', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const dir = await mkdtemp(join(tmpdir(), 'mock-'));
    const out = join(dir, 'out.md');
    const run = mockCodex('codex', runArgs(out), { timeoutMs: 1000, env: {} });
    await vi.advanceTimersByTimeAsync(MOCK_RUN_MS);
    expect((await run).code).toBe(0);

    const settings = parsePrompt(await readFile(join(__dirname, '..', '..', '..', 'bulletin.prompt.example.md'), 'utf8')).settings;
    const sheet = mockSheet();
    const holdings = portfolioMaker.holdings(sheet, settings);
    const wanted = [...holdings, ...settings.watch, 'USDTRY', 'XAU_GRAM_TRY'];
    const checked = checkBulletin(await readFile(out, 'utf8'), wanted, holdings, new Date());
    expect(checked.notes).toEqual([]);
    expect(checked.prices).toHaveLength(8);

    const { portfolio } = makePortfolio(sheet, checked.prices, settings);
    expect(portfolio.mix).not.toBeNull();
    expect(portfolio.totals.dayUsd).not.toBeNull();
    expect(portfolio.holdings.find((h) => h.ticker === 'WCH1')?.newPosition).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});

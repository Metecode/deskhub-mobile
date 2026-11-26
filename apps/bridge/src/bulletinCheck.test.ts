import { describe, expect, it } from 'vitest';
import { checkBulletin, checkPrice } from './bulletinCheck.js';

// Monday 30 Nov 2026, 08:00 in Istanbul.
const NOW = new Date('2026-11-30T05:00:00Z');
const ALLOWED = new Set(['ETF1', 'STK', 'USDTRY']);

const price = (over: Record<string, unknown> = {}) => ({
  ticker: 'ETF1',
  price: 100.5,
  previous_close: 99,
  currency: 'USD',
  kind: 'close',
  at: '2026-11-27T13:00:00-05:00', // Friday's early close
  source: 'https://example.com/etf1',
  ...over,
});

describe('checkPrice', () => {
  it('keeps a fresh, sourced price of a wanted ticker', () => {
    expect(checkPrice(price(), ALLOWED, NOW)).toEqual(price());
  });

  it.each([
    ['a ticker that is not wanted', { ticker: 'OTHER' }],
    ['an old one', { at: '2026-11-20T16:00:00-05:00' }],
    ['one from the future', { at: '2026-12-01T16:00:00-05:00' }],
    ['a close stamped while the market is open', { at: '2026-11-27T11:00:00-05:00' }],
    ['a source that is not http(s)', { source: 'javascript:alert(1)' }],
    ['no source', { source: undefined }],
    ['a price of 0', { price: 0 }],
    ['a price as text', { price: '100' }],
    ['a time without its offset', { at: '2026-11-27T13:00:00' }],
  ])('drops %s', (_, over) => {
    expect(checkPrice(price(over), ALLOWED, NOW)).toBeNull();
  });

  it('leaves the session rule to closes', () => {
    expect(checkPrice(price({ kind: 'spot', at: '2026-11-27T11:00:00-05:00' }), ALLOWED, NOW)).not.toBeNull();
  });

  it('takes a close at 16:00, and at 13:00 on an early close', () => {
    expect(checkPrice(price({ at: '2026-11-25T16:00:00-05:00' }), ALLOWED, NOW)).toBeNull(); // over 4 days
    expect(checkPrice(price({ at: '2026-11-26T16:00:00-05:00' }), ALLOWED, NOW)).not.toBeNull();
    expect(checkPrice(price({ at: '2026-11-27T13:00:00-05:00' }), ALLOWED, NOW)).not.toBeNull();
  });
});

const BULLETIN = `# Sabah bülteni

## 0. Bir bakışta
- Örnek.

## Kaynaklar
- [Kaynak A, 27 Kas](https://a.example/x)
- [Kaynak B](https://b.example/y) ve yine [Kaynak A](https://a.example/x)
- [Kötü](javascript:alert(1))

\`\`\`prices
${JSON.stringify(price())}
${JSON.stringify(price({ price: 1 }))}
not json
${JSON.stringify(price({ ticker: 'USDTRY', price: 49.8, currency: 'TRY', kind: 'spot', at: '2026-11-30T07:15:00+03:00' }))}
\`\`\`
`;

describe('checkBulletin', () => {
  it('takes the prices block out and keeps the first good line of each ticker', () => {
    const checked = checkBulletin(BULLETIN, [...ALLOWED], ['ETF1'], NOW);
    expect(checked.markdown).not.toContain('```');
    expect(checked.markdown.endsWith('[Kötü](javascript:alert(1))')).toBe(true);
    expect(checked.prices.map((p) => [p.ticker, p.price])).toEqual([
      ['ETF1', 100.5],
      ['USDTRY', 49.8],
    ]);
    expect(checked.notes).toEqual([]);
  });

  it('lists the sources once each, http(s) only', () => {
    expect(checkBulletin(BULLETIN, [...ALLOWED], [], NOW).sources).toEqual([
      { title: 'Kaynak A, 27 Kas', url: 'https://a.example/x' },
      { title: 'Kaynak B', url: 'https://b.example/y' },
    ]);
  });

  it('notes a holding without a price', () => {
    expect(checkBulletin(BULLETIN, [...ALLOWED], ['ETF1', 'STK'], NOW).notes).toEqual([
      { code: 'price_unverified', ticker: 'STK' },
    ]);
  });

  it('notes missing sources and prices', () => {
    expect(checkBulletin('# Bülten\n\nMetin.', [...ALLOWED], ['ETF1'], NOW).notes).toEqual([
      { code: 'no_sources' },
      { code: 'no_prices' },
    ]);
  });

  it('takes a block that was never closed, and a JSON array', () => {
    const open = `Metin\n\`\`\`prices\n[${JSON.stringify(price())}]`;
    const checked = checkBulletin(open, [...ALLOWED], [], NOW);
    expect(checked.markdown).toBe('Metin');
    expect(checked.prices).toHaveLength(1);
  });
});

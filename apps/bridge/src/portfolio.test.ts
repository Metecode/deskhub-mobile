// A made-up sheet with the headers of the user's (looked at on 26 Nov 2026); never the user's own numbers.
import type { Price } from '@deskhub-mobile/protocol';
import { describe, expect, it } from 'vitest';
import type { PromptSettings } from './bulletinPrompt.js';
import { makePortfolio, portfolioMaker, readSheet, trDate, trNumber } from './portfolio.js';
import type { Sheet } from './sheet.js';

const SHEET: Sheet = {
  readAt: new Date('2026-11-30T04:59:00Z'),
  tabs: [
    { name: 'Özet', rows: [['IBKR Takip Özeti', 'Değer', 'Açıklama']] },
    {
      name: 'Pozisyonlar',
      rows: [
        ['Sembol', 'Adet 13.11.2026 dahil', 'Maliyet USD', 'Fiyat USD — tarih için Özet', 'Değer USD', 'Gerçekleşmemiş K/Z USD', 'Belge ID'],
        ['ETF1', '10,0000', '1.000,00', '99,00', '990,00', '-10,00', 'DOC-1'],
        ['STK1', '2,0000', '300,00', '1', '1', '1', 'DOC-1'],
        ['RWD', '0,5000', '20,00', '1', '1', '1', 'DOC-1'],
        ['WCH1', '1,0000', '50,00', '1', '1', '1', 'DOC-2'],
        ['', '', '', '', '', '', ''],
      ],
    },
    {
      name: 'Alımlar',
      rows: [
        ['Kayıt ID', 'Tarih', 'Yıl', 'İşlem sembolü', 'Güncel sembol', 'Para birimi', 'Adet', 'Birim fiyat USD', 'Alım tutarı USD', 'Komisyon USD', 'Toplam maliyet USD', 'Belge ID', 'IBKR tarih/saat', 'İşlem kodu'],
        // On the positions' date: already in them.
        ['A1', '13.11.2026', '2026', 'ETF1', 'ETF1', 'USD', '1,0000', '99', '99,65', '0,35', '100,00', 'D', '', ''],
        // After it: added, under the current symbol.
        ['A2', '20.11.2026', '2026', 'OLD', 'ETF2', 'USD', '2,0000', '100', '200,15', '0,35', '200,50', 'D', '', ''],
        ['A3', '21.11.2026', '2026', 'ETF1', 'ETF1', 'USD', '1,0000', '100', '100,65', '0,35', '101,00', 'D', '', ''],
      ],
    },
    {
      name: 'Altın Alımları',
      rows: [
        ['Kayıt ID', 'Tarih', 'İşlem türü', 'Ayar', 'Gram', 'Birim maliyet TL/g', 'Toplam maliyet TL', 'Kaynak', 'Açıklama', 'Fon sınıflaması'],
        ['G1', '07.10.2026', 'Açılış bakiyesi', '24', '10,00', '5.000,00', '50.000,00', '', '', ''],
        ['G2', '04.11.2026', 'Alım', '22', '5,00', '4.000,00', '20.000,00', '', '', ''],
      ],
    },
    {
      name: 'Kontrol',
      rows: [
        ['Konu', 'Bulgu / yöntem', 'Durum'],
        ['Kurumsal işlem', '2026-04-21 ETF1(US0000000001) Split 8 for 1 (ETF1, ...)', 'Kaynak'],
        ['Kurumsal işlem', '2026-11-20 STK1(US0000000002) Split 2 for 1 (STK1, ...)', 'Kaynak'],
      ],
    },
  ],
};

const SETTINGS: PromptSettings = {
  stocks: ['STK1', 'WCH1'],
  rewards: ['RWD'],
  watch: ['WCH1', 'WCH2'],
  fallback: [],
  targets: { etf: 60, stock: 15, gold: 25 },
};

const p = (ticker: string, price: number, previous_close: number | null, currency: 'USD' | 'TRY' = 'USD'): Price => ({
  ticker,
  price,
  previous_close,
  currency,
  kind: currency === 'USD' ? 'close' : 'spot',
  at: '2026-11-27T13:00:00-05:00',
  source: `https://example.com/${ticker}`,
});

const PRICES = [
  p('ETF1', 110, 100),
  p('ETF2', 105, 100),
  p('STK1', 160, 150),
  p('WCH1', 40, null),
  p('RWD', 50, 48),
  p('USDTRY', 50, null, 'TRY'),
  p('XAU_GRAM_TRY', 6000, null, 'TRY'),
];

describe('trNumber and trDate', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['-2,14', -2.14],
    ['\\-15,23', -15.23],
    ['0,7660', 0.766],
    ['2025', 2025],
    ['', NaN],
    ['Kur eksik', NaN],
  ])('%s is %s', (text, n) => {
    expect(trNumber(text)).toBe(n);
  });

  it('reads a date in text', () => {
    expect(trDate('Adet 13.11.2026 dahil')).toBe('2026-11-13');
    expect(trDate('Adet')).toBeNull();
  });
});

describe('readSheet', () => {
  it('adds only the purchases after the positions’ date, and only 24 carat gold', () => {
    const read = readSheet(SHEET);
    expect(read.asOf).toBe('2026-11-13');
    expect(read.positions).toEqual([
      { ticker: 'ETF1', quantity: 11, costUsd: 1101 },
      { ticker: 'STK1', quantity: 2, costUsd: 300 },
      { ticker: 'RWD', quantity: 0.5, costUsd: 20 },
      { ticker: 'WCH1', quantity: 1, costUsd: 50 },
      { ticker: 'ETF2', quantity: 2, costUsd: 200.5 },
    ]);
    expect(read.gold).toEqual({ grams: 10, costTry: 50000 });
    expect(read.splitsAfter).toEqual(['STK1']);
  });

  it('says what is missing', () => {
    expect(() => readSheet({ ...SHEET, tabs: [] })).toThrow('Pozisyonlar');
    const noCost: Sheet = { readAt: SHEET.readAt, tabs: [{ name: 'Pozisyonlar', rows: [['Sembol', 'Adet']] }] };
    expect(() => readSheet(noCost)).toThrow('Maliyet USD');
  });

  it('adds no purchases when the positions have no date', () => {
    const tabs = SHEET.tabs.map((t) =>
      t.name === 'Pozisyonlar' ? { ...t, rows: [['Sembol', 'Adet', 'Maliyet USD'], ['ETF1', '1', '10']] } : t,
    );
    expect(readSheet({ ...SHEET, tabs }).positions).toEqual([{ ticker: 'ETF1', quantity: 1, costUsd: 10 }]);
  });
});

describe('makePortfolio', () => {
  const { portfolio, notes } = makePortfolio(SHEET, PRICES, SETTINGS);
  const row = (ticker: string) => portfolio.holdings.find((h) => h.ticker === ticker)!;

  it('works out each holding', () => {
    expect(row('ETF1')).toMatchObject({ kind: 'etf', quantity: 11, costUsd: 1101, valueUsd: 1210, pnlUsd: 109, pnlPct: 9.9, dayUsd: 110, newPosition: false });
    expect(row('STK1')).toMatchObject({ kind: 'stock', valueUsd: 320, pnlUsd: 20, pnlPct: 6.67, dayUsd: 20 });
    expect(row('ETF2')).toMatchObject({ kind: 'etf', valueUsd: 210, pnlUsd: 9.5, pnlPct: 4.74 });
  });

  it('marks a watched symbol that was bought as a new position', () => {
    expect(row('WCH1')).toMatchObject({ kind: 'stock', newPosition: true, pnlUsd: -10, pnlPct: -20, dayUsd: null });
  });

  it('shows reward shares, and leaves them out of the totals and the mix', () => {
    expect(row('RWD')).toMatchObject({ kind: 'reward', valueUsd: 25 });
    expect(portfolio.totals).toEqual({ costUsd: 1651.5, valueUsd: 1780, pnlUsd: 128.5, pnlPct: 7.78, dayUsd: null });
  });

  it('works out gold in TRY and the mix against the targets', () => {
    expect(portfolio.gold).toMatchObject({ grams: 10, costTry: 50000, valueTry: 60000, pnlTry: 10000, pnlPct: 20 });
    expect(portfolio.mix).toEqual({
      etf: { pct: 47.65, target: 60 },
      stock: { pct: 12.08, target: 15 },
      gold: { pct: 40.27, target: 25 },
    });
    expect(portfolio.quantitiesAsOf).toBe('2026-11-13');
  });

  it('notes a split after the positions’ date', () => {
    expect(notes).toEqual([{ code: 'split_after', ticker: 'STK1' }]);
  });

  it('never guesses a missing price', () => {
    const made = makePortfolio(SHEET, PRICES.filter((x) => x.ticker !== 'STK1' && x.ticker !== 'USDTRY'), SETTINGS).portfolio;
    expect(made.holdings.find((h) => h.ticker === 'STK1')).toMatchObject({ price: null, valueUsd: null, pnlUsd: null });
    expect(made.totals.valueUsd).toBeNull();
    expect(made.mix).toBeNull();
  });

  it('gives the bulletin the tickers to price', () => {
    expect(portfolioMaker.holdings(SHEET, SETTINGS)).toEqual(['ETF1', 'STK1', 'RWD', 'WCH1', 'ETF2']);
  });
});

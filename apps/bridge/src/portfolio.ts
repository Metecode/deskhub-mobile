// The portfolio's numbers, from the user's sheet and the bulletin's checked prices, in code, never by Codex
// (docs/plan-phase6.md). Columns are found by their header text, so that more can be added.
import {
  GRAM_GOLD,
  USDTRY,
  type BulletinNote,
  type GoldHolding,
  type Holding,
  type HoldingKind,
  type Portfolio,
  type Price,
} from '@deskhub-mobile/protocol';
import type { PromptSettings } from './bulletinPrompt.js';
import type { PortfolioMaker } from './bulletinService.js';
import type { Sheet } from './sheet.js';

/** "1.234,56" or "-2,14" as a number; NaN when it isn't one. */
export function trNumber(text: string | undefined): number {
  const clean = (text ?? '').trim().replace(/^\\-/, '-').replace(/\s/g, '');
  if (!/^-?[\d.]*\d(,\d+)?$/.test(clean)) return NaN;
  return Number(clean.replaceAll('.', '').replace(',', '.'));
}

/** "13.11.2026" as "2026-11-13"; null when it isn't one. */
export function trDate(text: string | undefined): string | null {
  const found = /(\d{2})\.(\d{2})\.(\d{4})/.exec(text ?? '');
  return found ? `${found[3]}-${found[2]}-${found[1]}` : null;
}

class Table {
  readonly #header: string[];
  readonly rows: string[][];

  constructor(
    readonly name: string,
    rows: string[][],
  ) {
    this.#header = (rows[0] ?? []).map((h) => h.trim());
    this.rows = rows.slice(1).filter((row) => row.some((c) => c.trim()));
  }

  /** The column whose header is `name`, or starts with it. Throws when there is none. */
  column(name: string, startsWith = false): number {
    const at = this.#header.findIndex((h) => (startsWith ? h.startsWith(name) : h === name));
    if (at < 0) throw new Error(`the tab "${this.name}" has no column "${name}"`);
    return at;
  }

  header(at: number): string {
    return this.#header[at] ?? '';
  }
}

function table(sheet: Sheet, name: string, required: boolean): Table | null {
  const tab = sheet.tabs.find((t) => t.name.trim() === name);
  if (!tab) {
    if (required) throw new Error(`the sheet has no tab "${name}"`);
    return null;
  }
  return new Table(name, tab.rows);
}

interface Position {
  ticker: string;
  quantity: number;
  costUsd: number;
}

interface Read {
  asOf: string | null;
  positions: Position[];
  gold: { grams: number; costTry: number } | null;
  splitsAfter: string[];
}

/** What the sheet holds: Pozisyonlar up to its date, and Alımlar after it. Throws when it can't be read. */
export function readSheet(sheet: Sheet): Read {
  const positions = table(sheet, 'Pozisyonlar', true)!;
  const symbol = positions.column('Sembol');
  const quantity = positions.column('Adet', true);
  const cost = positions.column('Maliyet USD');
  const asOf = trDate(positions.header(quantity));
  const held = new Map<string, Position>();
  for (const row of positions.rows) {
    const ticker = (row[symbol] ?? '').trim().toUpperCase();
    const q = trNumber(row[quantity]);
    const c = trNumber(row[cost]);
    if (!ticker || !Number.isFinite(q) || !Number.isFinite(c)) continue;
    held.set(ticker, { ticker, quantity: q, costUsd: c });
  }

  // Only what came after the positions' date, so nothing counts twice. Without that date, nothing.
  const purchases = table(sheet, 'Alımlar', false);
  if (purchases && asOf) {
    const date = purchases.column('Tarih');
    const current = purchases.column('Güncel sembol');
    const q = purchases.column('Adet');
    const total = purchases.column('Toplam maliyet USD');
    for (const row of purchases.rows) {
      const day = trDate(row[date]);
      const ticker = (row[current] ?? '').trim().toUpperCase();
      const quantity = trNumber(row[q]);
      const costUsd = trNumber(row[total]);
      if (!day || day <= asOf || !ticker || !Number.isFinite(quantity) || !Number.isFinite(costUsd)) continue;
      const before = held.get(ticker) ?? { ticker, quantity: 0, costUsd: 0 };
      held.set(ticker, { ticker, quantity: before.quantity + quantity, costUsd: before.costUsd + costUsd });
    }
  }

  // 24 carat only: gram gold is priced for it.
  let gold: Read['gold'] = null;
  const goldTab = table(sheet, 'Altın Alımları', false);
  if (goldTab) {
    const grams = goldTab.column('Gram');
    const carat = goldTab.column('Ayar');
    const total = goldTab.column('Toplam maliyet TL');
    let g = 0;
    let c = 0;
    for (const row of goldTab.rows) {
      if (trNumber(row[carat]) !== 24) continue;
      g += trNumber(row[grams]) || 0;
      c += trNumber(row[total]) || 0;
    }
    if (g > 0) gold = { grams: g, costTry: c };
  }

  // Splits are text there; one after the positions' date is never applied by guess.
  const splitsAfter: string[] = [];
  const checks = table(sheet, 'Kontrol', false);
  if (checks && asOf) {
    const finding = checks.column('Bulgu / yöntem');
    for (const row of checks.rows) {
      const found = /(\d{4}-\d{2}-\d{2})\s+([A-Z0-9.]+)\(.*\bSplit\b/i.exec(row[finding] ?? '');
      if (found?.[1] && found[2] && found[1] > asOf) splitsAfter.push(found[2]);
    }
  }
  return { asOf, positions: [...held.values()].filter((p) => p.quantity > 0), gold, splitsAfter };
}

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const pct = (part: number, whole: number) => (whole ? round((part / whole) * 100) : 0);

function kindOf(ticker: string, settings: PromptSettings): HoldingKind {
  if (settings.rewards.includes(ticker)) return 'reward';
  return settings.stocks.includes(ticker) ? 'stock' : 'etf';
}

/** Sums of numbers that may be missing: null if any is. */
function sum(values: readonly (number | null)[]): number | null {
  return values.some((v) => v === null) ? null : round(values.reduce<number>((a, v) => a + (v ?? 0), 0));
}

export function makePortfolio(
  sheet: Sheet,
  prices: readonly Price[],
  settings: PromptSettings,
): { portfolio: Portfolio; notes: BulletinNote[] } {
  const read = readSheet(sheet);
  const byTicker = new Map(prices.map((p) => [p.ticker, p]));
  const usd = (ticker: string) => {
    const p = byTicker.get(ticker);
    return p?.currency === 'USD' ? p : null;
  };

  const holdings: Holding[] = read.positions.map(({ ticker, quantity, costUsd }) => {
    const price = usd(ticker);
    const valueUsd = price ? round(quantity * price.price) : null;
    const pnlUsd = valueUsd === null ? null : round(valueUsd - costUsd);
    return {
      ticker,
      kind: kindOf(ticker, settings),
      quantity,
      costUsd: round(costUsd),
      price,
      valueUsd,
      pnlUsd,
      pnlPct: pnlUsd === null || !costUsd ? null : pct(pnlUsd, costUsd),
      dayUsd: price?.previous_close ? round(quantity * (price.price - price.previous_close)) : null,
      newPosition: settings.watch.includes(ticker),
    };
  });

  let gold: GoldHolding | null = null;
  if (read.gold) {
    const p = byTicker.get(GRAM_GOLD);
    const price = p?.currency === 'TRY' ? p : null;
    const valueTry = price ? round(read.gold.grams * price.price) : null;
    const pnlTry = valueTry === null ? null : round(valueTry - read.gold.costTry);
    gold = {
      grams: read.gold.grams,
      costTry: round(read.gold.costTry),
      price,
      valueTry,
      pnlTry,
      pnlPct: pnlTry === null || !read.gold.costTry ? null : pct(pnlTry, read.gold.costTry),
    };
  }

  // Reward shares are left out of returns and of the mix.
  const counted = holdings.filter((h) => h.kind !== 'reward');
  const costUsd = round(counted.reduce((a, h) => a + h.costUsd, 0));
  const valueUsd = sum(counted.map((h) => h.valueUsd));
  const pnlUsd = valueUsd === null ? null : round(valueUsd - costUsd);
  const totals = {
    costUsd,
    valueUsd,
    pnlUsd,
    pnlPct: pnlUsd === null || !costUsd ? null : pct(pnlUsd, costUsd),
    dayUsd: sum(counted.map((h) => h.dayUsd)),
  };

  let mix: Portfolio['mix'] = null;
  const rate = byTicker.get(USDTRY)?.price;
  const etf = sum(counted.filter((h) => h.kind === 'etf').map((h) => h.valueUsd));
  const stock = sum(counted.filter((h) => h.kind === 'stock').map((h) => h.valueUsd));
  const goldUsd = !read.gold ? 0 : gold?.valueTry != null && rate ? gold.valueTry / rate : null;
  if (etf !== null && stock !== null && goldUsd !== null) {
    const whole = etf + stock + goldUsd;
    const { targets } = settings;
    mix = {
      etf: { pct: pct(etf, whole), target: targets.etf },
      stock: { pct: pct(stock, whole), target: targets.stock },
      gold: { pct: pct(goldUsd, whole), target: targets.gold },
    };
  }

  return {
    portfolio: { quantitiesAsOf: read.asOf, readAt: sheet.readAt.toISOString(), holdings, gold, totals, mix },
    notes: read.splitsAfter.map((ticker) => ({ code: 'split_after', ticker })),
  };
}

export const portfolioMaker: PortfolioMaker = {
  holdings: (sheet) => readSheet(sheet).positions.map((p) => p.ticker),
  make: makePortfolio,
};

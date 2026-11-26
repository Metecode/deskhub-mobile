// The morning bulletin: written by Codex on the user's ChatGPT plan, checked and completed by the bridge
// (docs/plan-phase6.md). Nothing here comes from the companion.
import * as z from 'zod';

/** A day, local time. */
export type DateText = string;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PRICE_KINDS = ['close', 'premarket', 'afterhours', 'spot', 'futures'] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];

/** USD/TRY, and gram gold in TRY, besides the tickers. */
export const USDTRY = 'USDTRY';
export const GRAM_GOLD = 'XAU_GRAM_TRY';

/** One line of the `prices` block that Codex writes at the end of the bulletin. */
export const priceSchema = z.object({
  ticker: z.string().regex(/^[A-Z0-9_.]{1,16}$/),
  price: z.number().positive().finite(),
  /** Needed for the day's change; null or missing: not found. */
  previous_close: z.number().positive().finite().nullable().optional(),
  currency: z.enum(['USD', 'TRY']),
  kind: z.enum(PRICE_KINDS),
  /** ISO 8601 with its offset. */
  at: z.iso.datetime({ offset: true }),
  source: z.url({ protocol: /^https?$/ }),
});
export type Price = z.infer<typeof priceSchema>;

export interface Source {
  title: string;
  url: string;
}

/** Why a part of the bulletin couldn't be checked. Shown under its title, in Turkish (text.ts). */
export type BulletinNote =
  | { code: 'no_sources' }
  | { code: 'no_prices' }
  | { code: 'price_unverified'; ticker: string }
  | { code: 'sheet_unreadable' }
  | { code: 'split_after'; ticker: string };

/** What a holding is, for the target mix. */
export type HoldingKind = 'etf' | 'stock' | 'reward';

export interface Holding {
  ticker: string;
  kind: HoldingKind;
  quantity: number;
  /** Commission included. */
  costUsd: number;
  /** null: no checked price. */
  price: Price | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  /** % */
  pnlPct: number | null;
  /** The day's change from prices, not from purchases. */
  dayUsd: number | null;
  /** On the watch list of the prompt, but bought. */
  newPosition: boolean;
}

export interface GoldHolding {
  grams: number;
  costTry: number;
  price: Price | null;
  valueTry: number | null;
  pnlTry: number | null;
  pnlPct: number | null;
}

/** % of the whole, and the target. */
export interface MixPart {
  pct: number;
  target: number;
}

export interface Portfolio {
  /** How far the sheet's quantities go, and when the sheet was read. */
  quantitiesAsOf: DateText | null;
  readAt: string;
  holdings: Holding[];
  gold: GoldHolding | null;
  /** Reward shares left out. */
  totals: { costUsd: number; valueUsd: number | null; pnlUsd: number | null; pnlPct: number | null; dayUsd: number | null };
  /** null: a price or USD/TRY is missing. */
  mix: { etf: MixPart; stock: MixPart; gold: MixPart } | null;
}

export type BulletinError =
  | 'codex_missing'
  | 'codex_signed_out'
  | 'api_key_set'
  | 'unsafe_flags'
  | 'failed'
  | 'timeout'
  | 'empty';

export interface BulletinMessage {
  type: 'bridge.bulletin';
  /** off: no prompt file, so no tab. */
  state: 'off' | 'running' | 'ready' | 'failed';
  /** The day of what is shown. While running, the last one's, if any. */
  date?: DateText;
  /** Epoch ms. */
  startedAt?: number;
  madeAt?: number;
  /** Without the prices block. */
  markdown?: string;
  portfolio?: Portfolio | null;
  prices?: Price[];
  sources?: Source[];
  notes?: BulletinNote[];
  error?: BulletinError;
  /** Epoch ms: "Try again" may be pressed from then on. */
  retryAt?: number;
}

export const isDate = (text: string): boolean => DATE.test(text);

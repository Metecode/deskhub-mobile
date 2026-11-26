// Checks what Codex wrote: its sources and its prices (docs/plan-phase6.md). This tells whether a price is
// well formed, fresh and sourced; it can't tell whether the number is right.
import { priceSchema, type BulletinNote, type Price, type Source } from '@deskhub-mobile/protocol';

/** The prompt's own window: weekends and holidays included. */
export const PRICE_MAX_AGE_MS = 4 * 24 * 3600_000;
/** Clocks differ a little. */
const FUTURE_SLACK_MS = 10 * 60_000;

export interface Checked {
  /** Without the prices block. */
  markdown: string;
  prices: Price[];
  sources: Source[];
  notes: BulletinNote[];
}

const PRICES_BLOCK = /\n?```prices[^\n]*\n([\s\S]*?)(?:```|$)/;

function parsePriceLines(block: string): unknown[] {
  const trimmed = block.trim();
  if (trimmed.startsWith('[')) {
    try {
      const list: unknown = JSON.parse(trimmed);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
  return trimmed.split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line.trim().replace(/,$/, '')) as unknown];
    } catch {
      return [];
    }
  });
}

/**
 * A close can't be stamped while the New York exchange is surely open: from 09:30 to 13:00, as early
 * closes (the day after Thanksgiving, Christmas Eve) are at 13:00.
 */
function duringUsSession(at: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  if (get('weekday') === 'Sat' || get('weekday') === 'Sun') return false;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return minutes > 9 * 60 + 30 && minutes < 13 * 60;
}

/** A price that passes, or why not. */
export function checkPrice(value: unknown, allowed: ReadonlySet<string>, now: Date): Price | null {
  const parsed = priceSchema.safeParse(value);
  if (!parsed.success) return null;
  const price = parsed.data;
  if (!allowed.has(price.ticker)) return null;
  const at = new Date(price.at);
  const age = now.getTime() - at.getTime();
  if (age < -FUTURE_SLACK_MS || age > PRICE_MAX_AGE_MS) return null;
  if (price.kind === 'close' && duringUsSession(at)) return null;
  return price;
}

const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;

function sourcesOf(markdown: string): Source[] | null {
  const found = /^##\s+Kaynaklar\s*$/im.exec(markdown);
  if (!found) return null;
  const after = markdown.slice(found.index + found[0].length);
  const section = after.split(/^##\s/m)[0] ?? '';
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const [, title = '', url = ''] of section.matchAll(LINK)) {
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: title.trim(), url });
  }
  return sources;
}

/**
 * `wanted`: the tickers that need a price (holdings and watched ones, USD/TRY, gram gold). A holding
 * without a price that passes gets a note.
 */
export function checkBulletin(
  output: string,
  wanted: readonly string[],
  holdings: readonly string[],
  now: Date,
): Checked {
  const text = output.replace(/\r\n/g, '\n');
  const block = PRICES_BLOCK.exec(text);
  const markdown = (block ? text.slice(0, block.index) + text.slice(block.index + block[0].length) : text).trim();
  const notes: BulletinNote[] = [];

  const sources = sourcesOf(markdown);
  if (!sources?.length) notes.push({ code: 'no_sources' });

  const allowed = new Set(wanted);
  const prices = new Map<string, Price>();
  for (const value of block ? parsePriceLines(block[1] ?? '') : []) {
    const price = checkPrice(value, allowed, now);
    // The first one of a ticker counts.
    if (price && !prices.has(price.ticker)) prices.set(price.ticker, price);
  }
  if (!block || !prices.size) notes.push({ code: 'no_prices' });
  else for (const ticker of holdings) if (!prices.has(ticker)) notes.push({ code: 'price_unverified', ticker });

  return { markdown, prices: [...prices.values()], sources: sources ?? [], notes };
}

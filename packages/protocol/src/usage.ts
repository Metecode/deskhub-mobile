// Usage of the AI agent on the PC: Claude Code or Codex. Source: on_claude in
// firmware/main/hub_server.c, for "ai" and for "claude" from older companions.
import type { RawMessage } from './companion.js';
import { bool, fields, int, isObject, list, num, text } from './fields.js';
import { USAGE_DAYS, USAGE_MODELS } from './limits.js';

export interface UsageLimit {
  /** % used. */
  pct: number;
  /** When it resets, epoch seconds. */
  reset: number;
}

export interface Usage {
  provider: 'claude' | 'codex';
  /** null: no reading, or a window that is over. */
  fiveHour: UsageLimit | null;
  sevenDay: UsageLimit | null;
  /** When the agent last reported its limits, epoch seconds; 0 if it never did. */
  limitsUpdated: number;
  /** An estimate of the current 5-hour window. null: there is none. */
  block: { reset: number; tokens: number; messages: number } | null;
  today: { tokens: number; output: number; messages: number };
  /** Tokens. */
  lastHour: number;
  /** Tokens per day, oldest first; the last one is today. */
  days: readonly number[];
  /** Today's models. */
  models: readonly { name: string; tokens: number }[];
}

function readLimit(value: unknown): UsageLimit | null {
  if (!isObject(value)) return null;
  const o = fields(value);
  return { pct: num(o, 'pct'), reset: int(o, 'reset') };
}

export function normalizeUsage(raw: RawMessage): Usage {
  const limits = fields(raw.limits);
  const block = fields(raw.block);
  const today = fields(raw.today);
  const days = list(raw, 'days');
  return {
    provider: text(raw, 'provider') === 'codex' ? 'codex' : 'claude',
    fiveHour: readLimit(limits.five_hour),
    sevenDay: readLimit(limits.seven_day),
    limitsUpdated: int(limits, 'updated'),
    block: bool(block, 'active')
      ? { reset: int(block, 'reset'), tokens: num(block, 'tokens'), messages: int(block, 'messages') }
      : null,
    today: { tokens: num(today, 'tokens'), output: num(today, 'output'), messages: int(today, 'messages') },
    lastHour: num(raw, 'last_hour'),
    days: Array.from({ length: USAGE_DAYS }, (_, i) => {
      const v = days[i];
      return typeof v === 'number' ? v : 0;
    }),
    models: list(raw, 'models')
      .slice(0, USAGE_MODELS)
      .map((item) => {
        const m = fields(item);
        return { name: text(m, 'name'), tokens: num(m, 'tokens') };
      }),
  };
}

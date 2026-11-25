// What the AI page and the Home card say about usage (firmware/main/ui_claude.c,
// claude_limit and home_refresh_claude in ui_home.c). `now` is in epoch seconds.
import type { Usage, UsageLimit } from '@deskhub-mobile/protocol';
import { formatNumber, T } from './text.js';
import { formatClock, formatWeekday } from './time.js';

/** The agents' brand colours (ui_agent_color in ui.c). */
export const agentColor = (usage: Usage | null) => (usage?.provider === 'codex' ? '#10a37f' : '#d97757');

export const agentName = (usage: Usage | null) => (usage?.provider === 'codex' ? 'Codex' : 'Claude Code');

/** "1,2 Mr", "48,2 Mn", "182 B", "214" */
export function formatTokens(t: number): string {
  if (t >= 1e9) return T.usage.billion(formatNumber(t / 1e9, 1));
  if (t >= 1e6) return T.usage.million(formatNumber(t / 1e6, 1));
  if (t >= 1e3) return T.usage.thousand(formatNumber(t / 1e3));
  return String(Math.trunc(t));
}

export function levelColor(pct: number): string {
  return pct >= 80 ? 'var(--bad)' : pct >= 50 ? 'var(--warn)' : 'var(--good)';
}

export function formatCountdown(reset: number, now: number): string {
  const s = Math.trunc(reset - now);
  if (s <= 0) return T.usage.resetting;
  if (s >= 86_400) return T.usage.resetsOn(formatWeekday(reset), formatClock(reset));
  if (s >= 3600) return T.usage.resetsIn(T.hoursMinutes(Math.trunc(s / 3600), Math.trunc(s / 60) % 60));
  return T.usage.resetsIn(T.minutes(Math.trunc((s + 59) / 60)));
}

/** A reading of 10 minutes or more. Claude Code only reports limits while it is in use. */
export const isStale = (updated: number, now: number) => updated > 0 && now - updated >= 10 * 60;

export function formatAsOf(updated: number, now: number): string {
  return T.usage.asOf(now - updated < 20 * 3600 ? formatClock(updated) : formatWeekday(updated));
}

/** A limit card of the AI page. */
export interface LimitView {
  /** null: no bar, `big` instead. */
  pct: number | null;
  big: string;
  reset: string;
  sub: string;
}

const noBar = (big: string, reset = '', sub = ''): LimitView => ({ pct: null, big, reset, sub });

function limitView(limit: UsageLimit, updated: number, now: number): LimitView {
  return {
    pct: limit.pct,
    big: '',
    reset: formatCountdown(limit.reset, now),
    sub: isStale(updated, now) ? formatAsOf(updated, now) : '',
  };
}

export function fiveHourView(usage: Usage | null, now: number): LimitView {
  if (!usage) return noBar(T.none);
  const { fiveHour, sevenDay, limitsUpdated, block } = usage;
  if (fiveHour) return limitView(fiveHour, limitsUpdated, now);
  // Some Codex plans only have a weekly limit.
  if (sevenDay && usage.provider === 'codex') return noBar(T.none, '', T.usage.noFiveHour);
  // The window is over and the next prompt starts a new one. An old reading can't know
  // about prompts since.
  if (sevenDay && !isStale(limitsUpdated, now)) return { pct: 0, big: '', reset: T.usage.startsWithPrompt, sub: '' };
  if (!block) return noBar(T.usage.idle, '', T.usage.noWindow);
  return noBar(
    formatTokens(block.tokens),
    formatCountdown(block.reset, now),
    T.usage.estimate(block.messages),
  );
}

export function weeklyView(usage: Usage | null, now: number): LimitView {
  if (!usage) return noBar(T.none);
  if (usage.sevenDay) return limitView(usage.sevenDay, usage.limitsUpdated, now);
  return noBar(T.none, T.usage.noLimits, T.usage.appearsAfter(agentName(usage)));
}

/** A limit on the Home card. */
export interface HomeLimit {
  pct: number | null;
  color: string;
  sub: string;
}

function homeLimit(usage: Usage | null, limit: UsageLimit | null | undefined, online: boolean, now: number): HomeLimit {
  if (!usage || !limit) {
    const sub = !online ? T.pcOffline : usage ? T.usage.noData : T.waitingForPc;
    return { pct: null, color: 'var(--muted)', sub };
  }
  // An old reading doesn't count down, so that it isn't taken as current.
  const stale = isStale(usage.limitsUpdated, now);
  return {
    pct: limit.pct,
    color: levelColor(limit.pct),
    sub: stale ? formatAsOf(usage.limitsUpdated, now) : formatCountdown(limit.reset, now),
  };
}

export function homeLimits(usage: Usage | null, online: boolean, now: number): [fiveHour: HomeLimit, weekly: HomeLimit] {
  const weekly = homeLimit(usage, usage?.sevenDay, online, now);
  const fiveHour = homeLimit(usage, usage?.fiveHour, online, now);
  if (!usage?.sevenDay || usage.fiveHour) return [fiveHour, weekly];
  if (usage.provider === 'codex') return [{ ...fiveHour, sub: T.usage.noFiveHourShort }, weekly];
  if (isStale(usage.limitsUpdated, now)) return [{ ...fiveHour, sub: formatAsOf(usage.limitsUpdated, now) }, weekly];
  return [{ pct: 0, color: 'var(--good)', sub: T.usage.fresh }, weekly];
}

/** The names under the bars, oldest first. */
export const dayLabels = (count: number, now: number): string[] =>
  Array.from({ length: count }, (_, i) => (i === count - 1 ? T.today : formatWeekday(now - (count - 1 - i) * 86_400)));

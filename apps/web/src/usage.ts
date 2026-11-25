// What the AI page and the Home card say about usage (firmware/main/ui_claude.c,
// claude_limit and home_refresh_claude in ui_home.c). `now` is in epoch seconds.
import type { Usage, UsageLimit } from '@deskhub-mobile/protocol';
import { formatClock, formatWeekday } from './time.js';

/** The agents' brand colours (ui_agent_color in ui.c). */
export const agentColor = (usage: Usage | null) => (usage?.provider === 'codex' ? '#10a37f' : '#d97757');

export const agentName = (usage: Usage | null) => (usage?.provider === 'codex' ? 'Codex' : 'Claude Code');

/** "1.2B", "48.2M", "182K", "214" */
export function formatTokens(t: number): string {
  if (t >= 1e9) return `${(t / 1e9).toFixed(1)}B`;
  if (t >= 1e6) return `${(t / 1e6).toFixed(1)}M`;
  if (t >= 1e3) return `${(t / 1e3).toFixed(0)}K`;
  return String(Math.trunc(t));
}

export function levelColor(pct: number): string {
  return pct >= 80 ? 'var(--bad)' : pct >= 50 ? 'var(--warn)' : 'var(--good)';
}

export function formatCountdown(reset: number, now: number, hour12?: boolean): string {
  const s = Math.trunc(reset - now);
  if (s <= 0) return 'Resetting now';
  if (s >= 86_400) return `Resets ${formatWeekday(reset)} ${formatClock(reset, hour12)}`;
  if (s >= 3600) return `Resets in ${Math.trunc(s / 3600)}h ${String(Math.trunc(s / 60) % 60).padStart(2, '0')}m`;
  return `Resets in ${Math.trunc((s + 59) / 60)}m`;
}

/** A reading of 10 minutes or more. Claude Code only reports limits while it is in use. */
export const isStale = (updated: number, now: number) => updated > 0 && now - updated >= 10 * 60;

export function formatAsOf(updated: number, now: number, hour12?: boolean): string {
  return `as of ${now - updated < 20 * 3600 ? formatClock(updated, hour12) : formatWeekday(updated)}`;
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
  if (!usage) return noBar('--');
  const { fiveHour, sevenDay, limitsUpdated, block } = usage;
  if (fiveHour) return limitView(fiveHour, limitsUpdated, now);
  // Some Codex plans only have a weekly limit.
  if (sevenDay && usage.provider === 'codex') return noBar('--', '', 'This plan has no 5-hour limit');
  // The window is over and the next prompt starts a new one. An old reading can't know
  // about prompts since.
  if (sevenDay && !isStale(limitsUpdated, now)) return { pct: 0, big: '', reset: 'Starts with next prompt', sub: '' };
  if (!block) return noBar('Idle', '', 'No active window');
  return noBar(
    formatTokens(block.tokens),
    formatCountdown(block.reset, now),
    `tokens, ${block.messages} messages (estimate)`,
  );
}

export function weeklyView(usage: Usage | null, now: number): LimitView {
  if (!usage) return noBar('--');
  if (usage.sevenDay) return limitView(usage.sevenDay, usage.limitsUpdated, now);
  return noBar('--', 'No limit data yet', `Appears after a ${agentName(usage)} reply`);
}

/** A limit on the Home card. */
export interface HomeLimit {
  pct: number | null;
  color: string;
  sub: string;
}

function homeLimit(usage: Usage | null, limit: UsageLimit | null | undefined, online: boolean, now: number): HomeLimit {
  if (!usage || !limit) {
    const sub = !online ? 'PC offline' : usage ? 'No data yet' : 'Waiting for PC';
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
  if (usage.provider === 'codex') return [{ ...fiveHour, sub: 'No 5-hour limit' }, weekly];
  if (isStale(usage.limitsUpdated, now)) return [{ ...fiveHour, sub: formatAsOf(usage.limitsUpdated, now) }, weekly];
  return [{ pct: 0, color: 'var(--good)', sub: 'Fresh window ready' }, weekly];
}

/** The names under the bars, oldest first. */
export const dayLabels = (count: number, now: number): string[] =>
  Array.from({ length: count }, (_, i) => (i === count - 1 ? 'Today' : formatWeekday(now - (count - 1 - i) * 86_400)));

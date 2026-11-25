// GitHub contributions of the last year. Source: on_github in firmware/main/hub_server.c.
import type { RawMessage } from './companion.js';
import { bool, fields, int, list, text } from './fields.js';
import { GITHUB_DAYS, GITHUB_MONTHS, GITHUB_REPOS } from './limits.js';

export interface GitHub {
  login: string;
  /** Shades of the accent colour instead of greens. */
  accent: boolean;
  /** Contributions in the last year. */
  total: number;
  today: number;
  week: number;
  lastWeek: number;
  /** Days. */
  streak: number;
  longest: number;
  /** The busiest day. */
  best: number;
  /** "Nov 19" */
  bestDate: string;
  /** Weekday of the first day, 0 is Sunday. */
  startWeekday: number;
  /** 0 to 4 per day, oldest first; the last one is today. */
  levels: readonly number[];
  /** By week column. */
  months: readonly { column: number; name: string }[];
  /** Sunday to today. */
  weekDays: readonly number[];
  /** Seven. */
  lastWeekDays: readonly number[];
  commits: number;
  prs: number;
  reviews: number;
  issues: number;
  /** In private repositories. */
  privateCount: number;
  /** Most commits first. */
  repos: readonly { name: string; commits: number }[];
}

const numbers = (values: readonly unknown[]) =>
  values.slice(0, 7).map((v) => (typeof v === 'number' ? Math.trunc(v) : 0));

export function normalizeGitHub(raw: RawMessage): GitHub {
  let startWeekday = int(raw, 'start_wday') % 7;
  let digits = text(raw, 'levels');
  // Week columns that are cut.
  let shift = 0;
  if (digits.length > GITHUB_DAYS) {
    const drop = digits.length - GITHUB_DAYS;
    digits = digits.slice(drop);
    shift = Math.trunc((startWeekday + drop) / 7);
    startWeekday = (startWeekday + drop) % 7;
  }
  const kinds = fields(raw.kinds);
  const lastWeek = numbers(list(raw, 'last_week_days'));
  return {
    login: text(raw, 'login'),
    accent: bool(raw, 'accent'),
    total: int(raw, 'total'),
    today: int(raw, 'today'),
    week: int(raw, 'week'),
    lastWeek: int(raw, 'last_week'),
    streak: int(raw, 'streak'),
    longest: int(raw, 'longest'),
    best: int(raw, 'best'),
    bestDate: text(raw, 'best_date'),
    startWeekday,
    levels: [...digits].map((c) => (c >= '0' && c <= '4' ? Number(c) : 0)),
    months: list(raw, 'months')
      .flatMap((item) => {
        const [column, name] = Array.isArray(item) ? (item as unknown[]) : [];
        if (typeof column !== 'number' || typeof name !== 'string') return [];
        const shifted = Math.trunc(column) - shift;
        return shifted < 0 ? [] : [{ column: shifted, name }];
      })
      .slice(0, GITHUB_MONTHS),
    weekDays: numbers(list(raw, 'week_days')),
    lastWeekDays: Array.from({ length: 7 }, (_, i) => lastWeek[i] ?? 0),
    commits: int(kinds, 'commits'),
    prs: int(kinds, 'prs'),
    reviews: int(kinds, 'reviews'),
    issues: int(kinds, 'issues'),
    privateCount: int(kinds, 'private'),
    repos: list(raw, 'repos')
      .slice(0, GITHUB_REPOS)
      .map((item) => {
        const r = fields(item);
        return { name: text(r, 'name'), commits: int(r, 'count') };
      }),
  };
}

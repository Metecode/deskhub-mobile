// What the GitHub page and the Home card show (firmware/main/ui_github.c, layout_github and
// home_refresh_github in ui_home.c). Sizes are board pixels.
import type { GitHub } from '@deskhub-mobile/protocol';
import { formatNumber, monthDay, monthName, T } from './text.js';

/** Between squares. */
export const GAP = 2;

const GREENS = ['var(--card-hi)', '#0e4429', '#006d32', '#26a641', '#39d353'];
// Over the empty square (lv_color_mix by 77, 140 and 204 of 255).
const ACCENTS = [0, 30.2, 54.9, 80, 100].map(
  (pct) => `color-mix(in srgb, var(--accent) ${pct}%, var(--card-hi))`,
);

export const levelColor = (level: number, accent: boolean): string => (accent ? ACCENTS : GREENS)[level] ?? GREENS[0]!;

export const barColor = (github: GitHub | null) => (github?.accent ? 'var(--accent)' : '#26a641');

/** Week columns there are; 53 before the first message. */
export const totalWeeks = (github: GitHub | null): number =>
  github && github.levels.length > 0 ? Math.floor((github.levels.length - 1 + github.startWeekday) / 7) + 1 : 53;

export interface Square {
  column: number;
  row: number;
  level: number;
  today: boolean;
}

/** The squares of the newest `weeks` columns. */
export function squares(github: GitHub | null, weeks: number): Square[] {
  const levels = github?.levels ?? [];
  if (!github || levels.length === 0)
    return Array.from({ length: weeks * 7 }, (_, i) => ({ column: Math.floor(i / 7), row: i % 7, level: 0, today: false }));
  const first = totalWeeks(github) - weeks;
  return levels.flatMap((level, i) => {
    const day = i + github.startWeekday;
    const column = Math.floor(day / 7) - first;
    return column < 0 ? [] : [{ column, row: day % 7, level, today: i === levels.length - 1 }];
  });
}

/** About the width of three letters at 14 px. */
const MONTH_WIDTH = 28;

/** The month labels that fit over those columns: none that crowds the one before, or sticks out. */
export function monthLabels(github: GitHub | null, weeks: number, pitch: number): { x: number; name: string }[] {
  const first = totalWeeks(github) - weeks;
  let end = -1000;
  return (github?.months ?? []).flatMap(({ column, name }) => {
    const x = (column - first) * pitch;
    if (x < 0 || column - first >= weeks || x < end + 6 || x + MONTH_WIDTH > weeks * pitch) return [];
    end = x + MONTH_WIDTH;
    return [{ x, name: monthName(name) }];
  });
}

export interface ChartSize {
  pitch: number;
  weeks: number;
}

const clampWeeks = (width: number, pitch: number, github: GitHub | null) =>
  Math.max(1, Math.min(Math.floor((width + GAP) / pitch), totalWeeks(github)));

/** Below this a square is too small to see. Wide screens never get there. */
const MIN_PITCH = 9;

/** The page's chart: all 53 weeks across `width`, or with room for fewer, the newest that fit. */
export function pageChart(github: GitHub | null, width: number, height: number): ChartSize {
  const pitch = Math.min(16, Math.max(MIN_PITCH, Math.min(Math.floor((width + GAP) / 53), Math.floor((height + GAP) / 7))));
  return { pitch, weeks: clampWeeks(width, pitch, github) };
}

/** The Home card's chart in two rows: at most as high as it may be, with squares of 12 or more if they fit. */
export function tallChart(github: GitHub | null, width: number, height: number): ChartSize {
  const across = Math.max(12, Math.floor((width + GAP) / 53));
  const pitch = Math.max(6, Math.min(Math.floor((height + GAP) / 7), across));
  return { pitch, weeks: clampWeeks(width, pitch, github) };
}

/** The Home card's chart in one row: as high as the card. */
export function wideChart(github: GitHub | null, width: number, height: number): ChartSize {
  const pitch = Math.max(6, Math.floor((height + GAP) / 7));
  return { pitch, weeks: clampWeeks(width, pitch, github) };
}

/** "1.033" */
export const formatCount = (n: number) => formatNumber(n);

/** "1.033 katkı, 120 commit, 907 gizli" */
export function summary(github: GitHub): string {
  const kinds = [
    [github.commits, T.github.commits],
    [github.privateCount, T.github.private],
    [github.prs, T.github.prs],
    [github.reviews, T.github.reviews],
    [github.issues, T.github.issues],
  ] as const;
  const parts = kinds.filter(([n]) => n > 0).map(([n, what]) => what(formatCount(n)));
  return [T.github.contributions(formatCount(github.total)), ...parts].join(', ');
}

export const longestText = (github: GitHub) => T.days(github.longest);

export const bestText = ({ best, bestDate }: GitHub) => (best > 0 ? T.github.bestOn(best, monthDay(bestDate)) : T.none);

/** This week against last week. */
export function weekChange({ week, lastWeek }: GitHub): { text: string; more: boolean } {
  const diff = week - lastWeek;
  if (week === 0 && lastWeek === 0) return { text: '', more: false };
  if (diff === 0) return { text: T.github.same, more: false };
  return { text: diff > 0 ? T.github.more(diff) : T.github.less(-diff), more: diff > 0 };
}

export const homeTotal = (github: GitHub) =>
  T.github.homeTotal(formatCount(github.total)) +
  (github.privateCount > 0 ? `, ${T.github.private(formatCount(github.privateCount))}` : '');

export const homeStreak = ({ streak, today }: GitHub) => (streak > 0 ? T.github.homeStreak(streak) : T.github.homeToday(today));

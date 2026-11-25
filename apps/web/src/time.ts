// Times and dates in Turkish, in the phone's time zone. Times are epoch seconds.
import { LOCALE } from './text.js';

const two = (n: number) => String(n).padStart(2, '0');

/** "15:05" */
export function formatClock(t: number): string {
  const d = new Date(t * 1000);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "15:00" */
export const formatHour = (t: number): string => `${two(new Date(t * 1000).getHours())}:00`;

const part = (t: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, options).format(new Date(t * 1000));

/** "Cum" */
export const formatWeekday = (t: number) => part(t, { weekday: 'short' });

/** "20 Kasım Cuma" */
export const formatDate = (t: number) => part(t, { weekday: 'long', month: 'long', day: 'numeric' });

/** "20 Kas Cum" */
export const formatShortDate = (t: number) => part(t, { weekday: 'short', month: 'short', day: 'numeric' });

/** Midnight at the start of the day `t` is in, `days` later. */
export function startOfDay(t: number, days = 0): number {
  const d = new Date(t * 1000);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime() / 1000;
}

export const isSameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

/** "3:07", "1:02:09" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds));
  const h = Math.trunc(s / 3600);
  const m = Math.trunc(s / 60) % 60;
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

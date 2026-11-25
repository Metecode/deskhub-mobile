// Times and dates as the board writes them (ui_fmt_clock and friends in ui.c): in
// English, in the phone's time zone. Times are epoch seconds.

/** Whether the phone's locale has a 12-hour clock. */
export const HOUR12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;

const two = (n: number) => String(n).padStart(2, '0');
const twelve = (h: number) => h % 12 || 12;

export function amPm(t: number): string {
  return new Date(t * 1000).getHours() < 12 ? 'AM' : 'PM';
}

/** The clock's digits: "3:05" / "15:05". */
export function formatDigits(t: number, hour12 = HOUR12): string {
  const d = new Date(t * 1000);
  const h = d.getHours();
  return hour12 ? `${twelve(h)}:${two(d.getMinutes())}` : `${two(h)}:${two(d.getMinutes())}`;
}

/** "3:05 PM" / "15:05" */
export function formatClock(t: number, hour12 = HOUR12): string {
  return hour12 ? `${formatDigits(t, true)} ${amPm(t)}` : formatDigits(t, false);
}

/** "3 PM" / "15:00" */
export function formatHour(t: number, hour12 = HOUR12): string {
  const h = new Date(t * 1000).getHours();
  return hour12 ? `${twelve(h)} ${amPm(t)}` : `${two(h)}:00`;
}

const part = (t: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options).format(new Date(t * 1000));

/** "Fri" */
export const formatWeekday = (t: number) => part(t, { weekday: 'short' });

/** "Friday, November 20" */
export const formatDate = (t: number) => part(t, { weekday: 'long', month: 'long', day: 'numeric' });

/** "Fri Nov 20" */
export const formatShortDate = (t: number) =>
  `${formatWeekday(t)} ${part(t, { month: 'short', day: 'numeric' })}`;

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

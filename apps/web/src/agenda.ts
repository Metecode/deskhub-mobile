// What the Calendar page, the Up next widget and the Calendar tab's dot say about the
// events (firmware/main/ui_calendar.c, home_refresh_events in ui_home.c,
// ui_calendar_badge in ui.c). Times are epoch seconds.
import type { CalendarEvent, Events } from '@deskhub-mobile/protocol';
import { formatClock, formatDate, formatShortDate, HOUR12, isSameDay, startOfDay } from './time.js';

export const notOver = (events: readonly CalendarEvent[], now: number) => events.filter((e) => e.end > now);

export const isLive = (e: CalendarEvent, now: number) => !e.allDay && e.start <= now && e.end > now;

const isTomorrow = (t: number, now: number) => startOfDay(t) === startOfDay(now, 1);

export interface AgendaDay {
  /** Midnight. */
  day: number;
  title: string;
  events: CalendarEvent[];
}

/** The events by day. Those in progress are under today. */
export function agenda(events: readonly CalendarEvent[], now: number): AgendaDay[] {
  const days: AgendaDay[] = [];
  for (const event of notOver(events, now)) {
    const t = Math.max(event.start, now);
    const day = startOfDay(t);
    if (days.at(-1)?.day !== day) {
      const prefix = isSameDay(t, now) ? 'TODAY  •  ' : isTomorrow(t, now) ? 'TOMORROW  •  ' : '';
      days.push({ day, title: prefix + formatDate(t), events: [] });
    }
    days.at(-1)!.events.push(event);
  }
  return days;
}

/** "Today  •  3:30 PM" */
export function eventWhen(e: CalendarEvent, now: number, hour12 = HOUR12): string {
  const day = isSameDay(e.start, now) ? 'Today' : isTomorrow(e.start, now) ? 'Tomorrow' : formatShortDate(e.start);
  if (e.allDay) return `${day}  •  All day`;
  if (e.start <= now) return `Now  •  until ${formatClock(e.end, hour12)}`;
  return `${day}  •  ${formatClock(e.start, hour12)}`;
}

const span = (days: number) => (days === 1 ? 'the next day' : `the next ${days} days`);

/** The line that closes the list, after `shown` events. */
export function eventsSummary({ events, days }: Events, now: number, shown: number): string {
  const more = notOver(events, now).length - shown;
  if (more > 0) return `${more} more in ${span(days)}`;
  return shown > 0 ? `No more events in ${span(days)}` : `Nothing scheduled in ${span(days)}`;
}

/** The colour of the Calendar tab's dot: the next event, if it starts today. */
export function calendarBadge(events: readonly CalendarEvent[], now: number): string | null {
  const next = notOver(events, now)[0];
  return next && next.start < startOfDay(now, 1) ? next.color : null;
}

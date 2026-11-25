// What the Calendar page, the Up next widget and the Calendar tab's dot say about the
// events (firmware/main/ui_calendar.c, home_refresh_events in ui_home.c,
// ui_calendar_badge in ui.c). Times are epoch seconds.
import type { CalendarEvent, Events } from '@deskhub-mobile/protocol';
import { T } from './text.js';
import { formatClock, formatDate, formatShortDate, isSameDay, startOfDay } from './time.js';

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
      const prefix = isSameDay(t, now) ? T.today : isTomorrow(t, now) ? T.tomorrow : '';
      days.push({ day, title: T.agenda.title(prefix, formatDate(t)), events: [] });
    }
    days.at(-1)!.events.push(event);
  }
  return days;
}

/** "Bugün, 15:30" */
export function eventWhen(e: CalendarEvent, now: number): string {
  const day = isSameDay(e.start, now) ? T.today : isTomorrow(e.start, now) ? T.tomorrow : formatShortDate(e.start);
  if (e.allDay) return T.agenda.when(day, T.agenda.allDay);
  if (e.start <= now) return T.agenda.nowUntil(formatClock(e.end));
  return T.agenda.when(day, formatClock(e.start));
}

/** The line that closes the list, after `shown` events. */
export function eventsSummary({ events, days }: Events, now: number, shown: number): string {
  const more = notOver(events, now).length - shown;
  if (more > 0) return T.agenda.more(more, days);
  return shown > 0 ? T.agenda.noMore(days) : T.agenda.nothing(days);
}

/** The colour of the Calendar tab's dot: the next event, if it starts today. */
export function calendarBadge(events: readonly CalendarEvent[], now: number): string | null {
  const next = notOver(events, now)[0];
  return next && next.start < startOfDay(now, 1) ? next.color : null;
}

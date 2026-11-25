// Calendar events. Source: on_events in firmware/main/hub_server.c, ui_set_events in ui.c.
import type { RawMessage } from './companion.js';
import { bool, color, fields, int, list, text } from './fields.js';
import { MAX_EVENTS } from './limits.js';

export interface CalendarEvent {
  /** Epoch seconds. */
  start: number;
  end: number;
  allDay: boolean;
  /** "#rrggbb" */
  color: string;
  title: string;
  location: string;
  calendar: string;
}

export interface Events {
  /** By start; all-day ones first on the same start. */
  events: readonly CalendarEvent[];
  /** How many days ahead the companion looked. */
  days: number;
}

export function normalizeEvents(raw: RawMessage): Events {
  const events = list(raw, 'events')
    .slice(0, MAX_EVENTS)
    .map((item): CalendarEvent => {
      const e = fields(item);
      return {
        start: int(e, 'start'),
        end: int(e, 'end'),
        allDay: bool(e, 'all_day'),
        color: color(e, 'color', '#7c9cff'),
        title: text(e, 'title'),
        location: text(e, 'loc'),
        calendar: text(e, 'cal'),
      };
    })
    .sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay));
  const days = int(raw, 'days', 7);
  return { events, days: days > 0 ? days : 7 };
}

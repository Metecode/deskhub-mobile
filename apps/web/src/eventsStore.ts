// The last calendar, so it is there without the companion and after a reload. The board has it
// in RAM only. No more than it needs is kept: the days the companion looked ahead, and nothing
// that is over.
import { fields, normalizeEvents, type CalendarEvent, type Events } from '@deskhub-mobile/protocol';
import { loadJson, saveJson } from './saved.js';

const KEY = 'deskhub-mobile.events';

/** Times are epoch seconds. `at`: when the events came. */
export function eventsToKeep({ events, days }: Events, at: number, now: number): CalendarEvent[] {
  return events.filter((e) => e.end > now && e.start < at + days * 86_400);
}

export class EventsStore {
  #events: Events | null = null;
  #at = 0;
  #saved: string | null = null;

  /** What was saved, without what is over by now. */
  load(now: number): Events {
    const raw = fields(loadJson(KEY));
    const events = normalizeEvents({ ...raw, type: 'events' });
    // Not from the future, should the phone's clock have been set back.
    const at = typeof raw.at === 'number' ? Math.min(raw.at, now) : now;
    this.#events = events;
    this.#at = at;
    const kept = { ...events, events: eventsToKeep(events, at, now) };
    this.#save(now);
    return kept;
  }

  /** Takes over the connection's events. */
  update(events: Events, now: number): void {
    if (events === this.#events) return;
    this.#events = events;
    this.#at = now;
    this.#save(now);
  }

  /** To be called now and then: takes out what is over. */
  clean(now: number): void {
    this.#save(now);
  }

  #save(now: number): void {
    if (!this.#events) return;
    const kept = eventsToKeep(this.#events, this.#at, now);
    const value = kept.length
      ? {
          at: this.#at,
          days: this.#events.days,
          // The names of the message, so that it can be checked as one.
          events: kept.map((e) => ({
            start: e.start,
            end: e.end,
            all_day: e.allDay,
            color: e.color,
            title: e.title,
            loc: e.location,
            cal: e.calendar,
          })),
        }
      : null;
    const text = JSON.stringify(value);
    if (text === this.#saved) return;
    this.#saved = text;
    saveJson(KEY, value);
  }
}

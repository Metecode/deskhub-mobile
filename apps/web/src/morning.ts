// Günaydın: the morning in one place, once a day, and what "Dinle" says (docs/plan-phase6.md).
import type { BulletinMessage, CalendarEvent, TodayReminder } from '@deskhub-mobile/protocol';
import { notOver } from './agenda.js';
import { dayOf, hasBulletin, readingOf, sentences, type Reading } from './bulletin.js';
import { loadJson, saveJson } from './saved.js';
import { Store } from './store.js';
import { T } from './text.js';
import { formatClock, isSameDay } from './time.js';
import type { Weather } from './weather.js';
import { formatTemp, weatherText } from './weatherLook.js';

const KEY = 'deskhub-mobile.morning';
/** Not in the night. */
const FROM_HOUR = 5;

export interface MorningState {
  /** The days on which Günaydın was closed, today's bulletin opened, and the morning read on a touch. */
  closed: string | null;
  opened: string | null;
  read: string | null;
}

export class MorningStore extends Store<MorningState> {
  constructor() {
    const saved = (loadJson(KEY) ?? {}) as Partial<MorningState>;
    const day = (v: unknown) => (typeof v === 'string' ? v : null);
    super({ closed: day(saved.closed), opened: day(saved.opened), read: day(saved.read) });
  }

  #set(change: Partial<MorningState>): void {
    const next = { ...this.getState(), ...change };
    if (Object.entries(change).every(([k, v]) => this.getState()[k as keyof MorningState] === v)) return;
    saveJson(KEY, next);
    this.setState(next);
  }

  readonly close = (nowMs: number): void => this.#set({ closed: dayOf(nowMs) });
  readonly open = (nowMs: number): void => this.#set({ opened: dayOf(nowMs), closed: dayOf(nowMs) });
  readonly markRead = (nowMs: number): void => this.#set({ read: dayOf(nowMs) });
}

/** Günaydın is shown on Home: the bulletin is set up, it is morning on, and it wasn't closed today. */
export function showMorning(bulletin: BulletinMessage | null, morning: MorningState, nowMs: number): boolean {
  if (!bulletin || bulletin.state === 'off') return false;
  return new Date(nowMs).getHours() >= FROM_HOUR && morning.closed !== dayOf(nowMs);
}

/** A dot on the tab: today's bulletin is there and hasn't been opened. */
export function bulletinBadge(bulletin: BulletinMessage | null, morning: MorningState, nowMs: number): boolean {
  return hasBulletin(bulletin) && bulletin.state !== 'running' && bulletin.date === dayOf(nowMs) && morning.opened !== dayOf(nowMs);
}

/** Today's first event that isn't over, if any. `now` in seconds. */
export function firstEventToday(events: readonly CalendarEvent[], now: number): CalendarEvent | null {
  return notOver(events, now).find((e) => isSameDay(e.start, now) || e.start <= now) ?? null;
}

export interface MorningParts {
  weather: Weather | null;
  events: readonly CalendarEvent[];
  reminders: readonly TodayReminder[];
  bulletin: BulletinMessage | null;
  /** Epoch seconds. */
  now: number;
}

/** What "Dinle" on Günaydın reads: the morning, then the bulletin's short part if today's is there. */
export function morningReading({ weather, events, reminders, bulletin, now }: MorningParts): Reading {
  const say = T.morning.say;
  const lines: string[] = [say.hello];
  const today = weather?.days[0];
  if (weather) lines.push(say.weather(formatTemp(weather.temp), weatherText(weather.code), today ? formatTemp(today.hi) : ''));
  const event = firstEventToday(events, now);
  lines.push(event ? say.event(event.allDay ? '' : formatClock(event.start), event.title) : say.noEvents);
  for (const r of reminders) if (!r.done) lines.push(say.reminder(r.title));
  const own = sentences(lines.join('\n'));
  const fresh = hasBulletin(bulletin) && bulletin.state !== 'running' && bulletin.date === dayOf(now * 1000);
  const rest = fresh ? [sentences(say.bulletin)[0]!, ...readingOf(bulletin.markdown, false).sentences] : [];
  return { title: T.morning.hello, sentences: [...own, ...rest] };
}

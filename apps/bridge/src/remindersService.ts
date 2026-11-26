// Weekly reminders from reminders.json, and what is measured with them (docs/plan-phase6.md).
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  MEASUREMENT_DAYS,
  remindersFileSchema,
  WEEKDAYS,
  type Entry,
  type MeasurementsMessage,
  type Reminder,
  type RemindersMessage,
  type Values,
} from '@deskhub-mobile/protocol';
import { dayOf } from './bulletinService.js';
import type { Logger } from './log.js';

const CHECK_EVERY_MS = 60_000;

export interface RemindersServiceOptions {
  file: string;
  dataDir: string;
  publish: (message: RemindersMessage) => void;
  log: Logger;
  now?: () => Date;
}

interface Stored extends Entry {
  id: string;
}

export class RemindersService {
  readonly #o: Required<RemindersServiceOptions>;
  #reminders: Reminder[] = [];
  #entries: Stored[] = [];
  #day = '';
  #timer: NodeJS.Timeout | undefined;

  constructor(options: RemindersServiceOptions) {
    this.#o = { now: () => new Date(), ...options };
  }

  get #store(): string {
    return join(this.#o.dataDir, 'measurements.jsonl');
  }

  async start(): Promise<void> {
    await this.load();
    this.#day = dayOf(this.#o.now());
    // A new day has other reminders.
    this.#timer = setInterval(() => {
      const day = dayOf(this.#o.now());
      if (day !== this.#day) {
        this.#day = day;
        this.#o.publish(this.message());
      }
    }, CHECK_EVERY_MS);
  }

  stop(): void {
    clearInterval(this.#timer);
  }

  /** Reads reminders.json and the entries. A wrong file is logged and means none. */
  async load(): Promise<void> {
    this.#reminders = [];
    try {
      const parsed = remindersFileSchema.safeParse(JSON.parse(await readFile(this.#o.file, 'utf8')));
      if (parsed.success) this.#reminders = parsed.data;
      else this.#o.log.warn(`reminders: ${this.#o.file} is not as reminders.example.json`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') this.#o.log.warn(`reminders: ${(e as Error).message}`);
    }
    this.#entries = [];
    const text = await readFile(this.#store, 'utf8').catch(() => '');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as Stored;
        if (typeof entry.id === 'string' && typeof entry.at === 'number' && entry.values) this.#entries.push(entry);
      } catch {
        // A torn last line: left out.
      }
    }
  }

  #of(id: string): Stored[] {
    return this.#entries.filter((e) => e.id === id).sort((a, b) => a.at - b.at);
  }

  message(): RemindersMessage {
    const now = this.#o.now();
    const weekday = WEEKDAYS[now.getDay()];
    const today = dayOf(now);
    const strip = ({ at, values }: Stored): Entry => ({ at, values });
    return {
      type: 'bridge.reminders',
      reminders: this.#reminders
        .filter((r) => r.day === weekday)
        .map((r) => {
          const entries = this.#of(r.id);
          const last = entries.at(-1);
          const previous = entries.at(-2);
          return {
            ...r,
            done: !!last && dayOf(new Date(last.at)) === today,
            last: last ? strip(last) : null,
            previous: previous ? strip(previous) : null,
          };
        }),
      measured: this.#reminders.filter((r) => r.fields.length).map(({ id, title, fields }) => ({ id, title, fields })),
    };
  }

  /** Saves an entry of a known reminder with exactly its fields. False when it isn't one. */
  async save(id: string, values: Values): Promise<boolean> {
    const reminder = this.#reminders.find((r) => r.id === id);
    if (!reminder) return false;
    const keys = reminder.fields.map((f) => f.key).sort();
    if (keys.join() !== Object.keys(values).sort().join()) return false;
    const entry: Stored = { id, at: this.#o.now().getTime(), values: Object.fromEntries(keys.map((k) => [k, values[k]!])) };
    await mkdir(dirname(this.#store), { recursive: true });
    await appendFile(this.#store, `${JSON.stringify(entry)}\n`, 'utf8');
    this.#entries.push(entry);
    this.#o.publish(this.message());
    return true;
  }

  /** A reminder's entries of the last half year, for the chart. null: no such reminder. */
  measurements(id: string): MeasurementsMessage | null {
    const reminder = this.#reminders.find((r) => r.id === id);
    if (!reminder) return null;
    const since = this.#o.now().getTime() - MEASUREMENT_DAYS * 24 * 3600_000;
    return {
      type: 'bridge.measurements',
      id,
      fields: reminder.fields,
      entries: this.#of(id)
        .filter((e) => e.at >= since)
        .map(({ at, values }) => ({ at, values })),
    };
  }
}

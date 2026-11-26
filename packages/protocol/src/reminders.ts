// Weekly reminders and what is measured with them (docs/plan-phase6.md). The bridge's own.
import * as z from 'zod';

export const ID = /^[a-z0-9-]{1,32}$/;

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The most a value may be; the fields are body measures, so this is generous. */
export const MAX_VALUE = 10_000;

export const reminderFieldSchema = z.object({
  key: z.string().regex(ID),
  /** Shown as it is: the user writes it. */
  label: z.string().min(1).max(24),
  unit: z.string().max(8).default(''),
});
export type ReminderField = z.infer<typeof reminderFieldSchema>;

/** One entry of reminders.json, next to .env. */
export const reminderSchema = z.object({
  id: z.string().regex(ID),
  title: z.string().min(1).max(60),
  day: z.enum(WEEKDAYS),
  fields: z.array(reminderFieldSchema).max(4).default([]),
});
export type Reminder = z.infer<typeof reminderSchema>;
export const remindersFileSchema = z.array(reminderSchema).max(10);

export type Values = Record<string, number>;

export interface Entry {
  /** Epoch ms. */
  at: number;
  values: Values;
}

export interface TodayReminder extends Reminder {
  /** Saved today. */
  done: boolean;
  /** The latest entry, and the one before it. */
  last: Entry | null;
  previous: Entry | null;
}

/** Today's reminders. Sent when one connects, at midnight and after every save. */
export interface RemindersMessage {
  type: 'bridge.reminders';
  reminders: TodayReminder[];
  /** Every reminder with fields, whatever its day: their charts can be opened any day. */
  measured: Pick<Reminder, 'id' | 'title' | 'fields'>[];
}

/** A reminder's entries, oldest first, for the chart. */
export interface MeasurementsMessage {
  type: 'bridge.measurements';
  id: string;
  fields: ReminderField[];
  entries: Entry[];
}

/** How far back the chart goes. */
export const MEASUREMENT_DAYS = 183;

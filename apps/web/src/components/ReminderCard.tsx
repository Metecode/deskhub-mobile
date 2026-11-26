// Today's reminder in the panel, in place of the next event; its fields are filled in here
// (docs/plan-phase6.md).
import type { TodayReminder, Values } from '@deskhub-mobile/protocol';
import { useState } from 'react';
import { changeOf } from '../bulletin.js';
import { formatNumber, T } from '../text.js';
import styles from './ReminderCard.module.css';

/** "78,4" or "78.4" as a number; null when it isn't one. */
export function parseValue(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

const valuesText = (r: TodayReminder, values: Values) =>
  r.fields.map((f) => `${formatNumber(values[f.key] ?? 0, 1)} ${f.unit}`.trim()).join(' · ');

interface ReminderCardProps {
  reminder: TodayReminder;
  onSave: (values: Values) => void;
  onLater: () => void;
  onChart: () => void;
}

export function ReminderCard({ reminder, onSave, onLater, onChart }: ReminderCardProps) {
  const [editing, setEditing] = useState(false);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const parsed = reminder.fields.map((f) => [f.key, parseValue(texts[f.key] ?? '')] as const);
  const complete = parsed.every(([, v]) => v !== null);
  const { last, previous } = reminder;
  const change = reminder.fields
    .map((f) => {
      const d = changeOf(last, previous, f.key);
      return d === null ? null : `${d > 0 ? '+' : d < 0 ? '−' : ''}${formatNumber(Math.abs(d), 1)} ${f.unit}`.trim();
    })
    .filter(Boolean);

  if (!reminder.fields.length) {
    return (
      <section className={styles.card}>
        <p className={styles.label}>{T.reminders.today}</p>
        <p className={styles.title}>{reminder.title}</p>
        <div className={styles.buttons}>
          <button type="button" onClick={onLater}>
            {T.reminders.later}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      {!editing && <p className={styles.label}>{T.reminders.today}</p>}
      <p className={styles.title}>{reminder.title}</p>
      {!editing && last && (
        <button type="button" className={styles.last} onClick={onChart}>
          {T.reminders.last(valuesText(reminder, last.values))}
          {change.length > 0 && <span className={styles.change}>{T.reminders.change(change.join(' · '))}</span>}
        </button>
      )}
      {editing ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!complete) return;
            onSave(Object.fromEntries(parsed) as Values);
            setEditing(false);
            setTexts({});
          }}
        >
          {reminder.fields.map((f, i) => (
            <label key={f.key} className={styles.field}>
              <span>{f.label}</span>
              <input
                // Text with a decimal keyboard: a number input may refuse "78,4".
                type="text"
                inputMode="decimal"
                autoFocus={i === 0}
                value={texts[f.key] ?? ''}
                placeholder={last ? formatNumber(last.values[f.key] ?? 0, 1) : ''}
                onChange={(e) => setTexts({ ...texts, [f.key]: e.target.value })}
              />
              <span className={styles.unit}>{f.unit}</span>
            </label>
          ))}
          <div className={styles.buttons}>
            <button type="submit" className={styles.main} disabled={!complete}>
              {T.reminders.save}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              {T.reminders.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.buttons}>
          <button type="button" className={styles.main} onClick={() => setEditing(true)}>
            {T.reminders.save}
          </button>
          <button type="button" onClick={onLater}>
            {T.reminders.later}
          </button>
        </div>
      )}
    </section>
  );
}

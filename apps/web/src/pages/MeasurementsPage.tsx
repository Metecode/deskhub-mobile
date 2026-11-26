// What was measured with the reminders: each entry as a point, the 4-week mean as a line, the last half
// year (docs/plan-phase6.md). Our own SVG, as HistoryChart.
import type { Entry, MeasurementsMessage, ReminderField } from '@deskhub-mobile/protocol';
import { useEffect } from 'react';
import { movingAverage } from '../bulletin.js';
import { Icon } from '../components/Icon.js';
import type { BridgeState } from '../connection.js';
import { formatNumber, T } from '../text.js';
import { formatShortDate } from '../time.js';
import styles from './MeasurementsPage.module.css';

const W = 600;
const H = 140;
const PAD = 10;

function Chart({ field, entries }: { field: ReminderField; entries: readonly Entry[] }) {
  const points = entries.filter((e) => typeof e.values[field.key] === 'number');
  if (!points.length) return null;
  const values = points.map((e) => e.values[field.key]!);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const t0 = points[0]!.at;
  const t1 = points.at(-1)!.at;
  const x = (t: number) => (t1 === t0 ? W / 2 : PAD + ((t - t0) / (t1 - t0)) * (W - 2 * PAD));
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - 2 * PAD);
  const average = movingAverage(points, field.key);
  const line = average
    .map((v, i) => (v === null ? '' : `${i ? 'L' : 'M'}${x(points[i]!.at).toFixed(1)} ${y(v).toFixed(1)}`))
    .join('');
  const last = values.at(-1)!;
  return (
    <section className={styles.field}>
      <p className={styles.head}>
        <span className={styles.name}>{field.label}</span>
        <span className={styles.value}>{`${formatNumber(last, 1)} ${field.unit}`.trim()}</span>
        <span className={styles.range}>
          {formatNumber(lo, 1)} – {formatNumber(hi, 1)}
        </span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={field.label}>
        <path className={styles.average} d={line} />
        {points.map((e, i) => (
          <circle key={e.at} className={styles.point} cx={x(e.at)} cy={y(values[i]!)} r={4} />
        ))}
      </svg>
      <p className={styles.axis}>
        <span>{formatShortDate(Math.floor(t0 / 1000))}</span>
        <span>{formatShortDate(Math.floor(t1 / 1000))}</span>
      </p>
    </section>
  );
}

interface MeasurementsProps {
  state: BridgeState;
  ask: (id: string) => void;
  onBack: () => void;
}

export function MeasurementsPage({ state, ask, onBack }: MeasurementsProps) {
  const measured = state.reminders?.measured ?? [];
  const ids = measured.map((m) => m.id).join();
  useEffect(() => {
    for (const id of ids.split(',').filter(Boolean)) ask(id);
  }, [ids, ask]);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} aria-label={T.measurements.back} onClick={onBack}>
          <Icon name="arrow_upward" size={22} />
        </button>
        <h1 className={styles.title}>{T.measurements.title}</h1>
        <span className={styles.legend}>
          <span className={styles.legendLine} /> {T.measurements.average}
        </span>
      </header>
      <div className={styles.body}>
        {measured.map((m) => {
          const chart: MeasurementsMessage | undefined = state.measurements[m.id];
          return (
            <div key={m.id}>
              <h2 className={styles.reminder}>{m.title}</h2>
              {chart?.entries.length ? (
                m.fields.map((f) => <Chart key={f.key} field={f} entries={chart.entries} />)
              ) : (
                <p className={styles.muted}>{T.measurements.empty}</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

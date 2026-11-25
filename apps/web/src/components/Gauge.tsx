import type { CSSProperties } from 'react';
import { formatPercent } from '../format.js';
import styles from './Gauge.module.css';

// The board's gauge (ui_stats.c, make_gauge): 112 px, 12 px thick, 270 degrees from 135.
const ARC = 'M20.64 91.36 A50 50 0 1 1 91.36 91.36';

interface GaugeProps {
  name: string;
  color: string;
  /** null: nothing to show. */
  percent: number | null;
  sub: string;
}

export function Gauge({ name, color, percent, sub }: GaugeProps) {
  const value = Math.min(100, Math.max(0, percent ?? 0));
  return (
    <section className={styles.card} style={{ '--series': color } as CSSProperties}>
      <div className={styles.dial}>
        <svg viewBox="0 0 112 112" className={styles.svg} aria-hidden="true">
          <path className={styles.track} d={ARC} />
          {value > 0 && <path className={styles.value} d={ARC} pathLength={100} strokeDasharray={`${value} 200`} />}
        </svg>
        <span className={styles.percent}>{percent === null ? '--' : formatPercent(percent)}</span>
      </div>
      <h2 className={styles.name}>{name}</h2>
      <p className={styles.sub}>{sub}</p>
    </section>
  );
}

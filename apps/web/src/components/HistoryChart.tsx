import { linePath } from '../chart.js';
import { HISTORY_MS, type HistoryPoint } from '../connection.js';
import { T } from '../text.js';
import styles from './HistoryChart.module.css';

// Four division lines, edges included, like the board's chart.
const DIVISIONS = [0, 100 / 3, 200 / 3, 100];

export function HistoryChart({ history }: { history: readonly HistoryPoint[] }) {
  return (
    <svg
      viewBox={`0 0 ${HISTORY_MS} 100`}
      preserveAspectRatio="none"
      className={styles.chart}
      role="img"
      aria-label={T.stats.chart}
    >
      {DIVISIONS.map((y) => (
        <path key={y} className={styles.division} d={`M0 ${y}H${HISTORY_MS}`} />
      ))}
      <path className={styles.line} stroke="var(--cpu)" d={linePath(history, (p) => p.cpu)} />
      <path className={styles.line} stroke="var(--gpu)" d={linePath(history, (p) => p.gpu)} />
    </svg>
  );
}

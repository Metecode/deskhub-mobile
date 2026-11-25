import { formatPercent } from '../format.js';
import { T } from '../text.js';
import styles from './Ring.module.css';

// 112 wide, 11 thick, 270 degrees from 135.
const ARC = 'M20.29 91.71 A50.5 50.5 0 1 1 91.71 91.71';

interface RingProps {
  /** null: nothing to show. */
  percent: number | null;
  color: string;
  /** Page units. */
  size: number;
}

export function Ring({ percent, color, size }: RingProps) {
  const value = Math.min(100, Math.max(0, percent ?? 0));
  return (
    <div className={styles.ring} style={{ width: `calc(${size} * var(--u))` }}>
      <svg viewBox="0 0 112 100" aria-hidden="true">
        <path className={styles.track} d={ARC} />
        {value > 0 && <path className={styles.value} d={ARC} stroke={color} pathLength={100} strokeDasharray={`${value} 200`} />}
      </svg>
      <span className={styles.percent} style={{ fontSize: `calc(${size * 0.26} * var(--u))` }}>
        {percent === null ? T.none : formatPercent(percent)}
      </span>
    </div>
  );
}

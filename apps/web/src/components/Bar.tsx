import styles from './Bar.module.css';

interface BarProps {
  /** % */
  value: number;
  color: string;
  /** Board pixels. */
  height: number;
}

export function Bar({ value, color, height }: BarProps) {
  return (
    <span className={styles.track} style={{ height: `calc(${height} * var(--u))` }}>
      <span className={styles.value} style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </span>
  );
}

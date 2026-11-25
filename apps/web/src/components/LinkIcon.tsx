// The connection: three arcs when it is good, two when fair, one when poor, crossed out when there is
// none. Number and colour say the same.
import type { LinkLevel } from '../linkQuality.js';
import styles from './LinkIcon.module.css';

const ARCS = ['M9.4 16.7a3.8 3.8 0 0 1 5.2 0', 'M6 13.2a8.5 8.5 0 0 1 12 0', 'M2.5 9.5a13.5 13.5 0 0 1 19 0'];
const LIT: Readonly<Record<LinkLevel, number>> = { poor: 1, fair: 2, good: 3 };

interface LinkIconProps {
  /** null: no connection to the bridge. */
  level: LinkLevel | null;
  /** The bridge is there, but the companion isn't. */
  pcMissing: boolean;
}

export function LinkIcon({ level, pcMissing }: LinkIconProps) {
  return (
    <>
      <svg viewBox="0 0 24 24" className={styles.icon} data-level={level ?? 'none'} aria-hidden="true">
        {ARCS.map((d, i) => (
          <path key={d} d={d} className={level && i < LIT[level] ? undefined : styles.off} />
        ))}
        <circle cx="12" cy="20" r="1.3" className={styles.dot} />
        {!level && <path d="M4 3l16 18" className={styles.cross} />}
      </svg>
      {pcMissing && (
        <svg viewBox="0 0 24 24" className={styles.icon} data-level="none" aria-hidden="true">
          <path d="M3.5 5h17v11h-17zM9 20h6M12 16v4" className={styles.off} />
          <path d="M4 3l16 18" className={styles.cross} />
        </svg>
      )}
    </>
  );
}

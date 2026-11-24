import type { Link } from '../connection.js';
import styles from './StatusBadge.module.css';

/** The PC's state, like the monitor icon on the board's rail. */
export function StatusBadge({ link, pcOnline }: { link: Link; pcOnline: boolean }) {
  const [className, text] =
    link === 'bad_origin'
      ? [styles.lost, 'Not allowed']
      : link !== 'open'
        ? [styles.lost, 'Connecting']
        : pcOnline
          ? [styles.online, 'PC online']
          : [styles.offline, 'PC offline'];
  return (
    <div className={`${styles.badge} ${className}`} role="status">
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
        <rect x="2.5" y="4" width="19" height="13" rx="1.5" />
        <path d="M8 21h8M12 17v4" />
      </svg>
      {text}
    </div>
  );
}

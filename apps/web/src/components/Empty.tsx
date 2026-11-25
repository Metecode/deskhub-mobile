import type { IconName } from '../icons.js';
import styles from './Empty.module.css';
import { Icon } from './Icon.js';

/** A page with nothing to show. */
export function Empty({ icon, title, hint }: { icon?: IconName; title: string; hint: string }) {
  return (
    <div className={styles.empty}>
      {icon && <Icon name={icon} size={64} color="var(--dim)" />}
      <p className={styles.title}>{title}</p>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}

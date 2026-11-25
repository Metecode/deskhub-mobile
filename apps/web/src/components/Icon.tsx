import { glyph, type IconName } from '../icons.js';
import styles from './Icon.module.css';

/** A Material icon, `size` board pixels high. */
export function Icon({ name, size, color }: { name: IconName; size: number; color?: string }) {
  return (
    <span className={styles.icon} style={{ fontSize: `calc(${size} * var(--u))`, color }} aria-hidden="true">
      {glyph(name)}
    </span>
  );
}

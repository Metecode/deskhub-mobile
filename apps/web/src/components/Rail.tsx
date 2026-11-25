// The navigation bar (build_rail in firmware/main/ui.c).
import type { Link } from '../connection.js';
import { TABS, type Tab } from '../nav.js';
import { Icon } from './Icon.js';
import styles from './Rail.module.css';

interface RailProps {
  tabs: readonly Tab[];
  current: Tab;
  onSelect: (tab: Tab) => void;
  /** The colour of the dot on the Calendar tab, or null. */
  calendarBadge: string | null;
  link: Link;
  online: boolean;
}

export function Rail({ tabs, current, onSelect, calendarBadge, link, online }: RailProps) {
  return (
    <nav className={styles.rail}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={styles.tab}
          aria-label={TABS[tab].label}
          aria-current={tab === current ? 'page' : undefined}
          onClick={() => onSelect(tab)}
        >
          <Icon name={TABS[tab].icon} size={32} />
          {tab === 'calendar' && calendarBadge && (
            <span className={styles.badge} style={{ background: calendarBadge }} />
          )}
        </button>
      ))}
      <div className={styles.status}>
        <span role="img" aria-label={online ? 'PC online' : 'PC offline'} className={online ? styles.good : styles.off}>
          <Icon name="desktop_windows" size={24} />
        </span>
        <span
          role="img"
          aria-label={link === 'open' ? 'Connected to the bridge' : 'Not connected to the bridge'}
          className={link === 'open' ? styles.good : styles.bad}
        >
          <Icon name={link === 'open' ? 'wifi' : 'wifi_off'} size={24} />
        </span>
      </div>
    </nav>
  );
}

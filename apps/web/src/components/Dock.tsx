// The pages, with their names.
import type { Usage } from '@deskhub-mobile/protocol';
import { markedTab, TABS, type Dock as DockTabs, type Tab, type View } from '../nav.js';
import { PAGE_NAMES, T } from '../text.js';
import { AgentIcon } from './AgentIcon.js';
import styles from './Dock.module.css';
import { Icon } from './Icon.js';

interface DockProps {
  dock: DockTabs;
  view: View;
  onSelect: (view: View) => void;
  /** The colours of the dots on tabs. */
  badges: Readonly<Partial<Record<Tab, string | null>>>;
  usage: Usage | null;
}

/** "Claude", or the other agent while that one shows. */
export const tabName = (tab: Tab, usage: Usage | null): string =>
  tab === 'ai' && usage?.provider === 'codex' ? T.nav.codex : PAGE_NAMES[tab];

export function TabIcon({ tab, usage, size }: { tab: Tab; usage: Usage | null; size: number }) {
  return tab === 'ai' ? <AgentIcon usage={usage} size={size} /> : <Icon name={TABS[tab]} size={size} />;
}

export function Dock({ dock, view, onSelect, badges, usage }: DockProps) {
  const marked = markedTab(view, dock);
  const restBadge = dock.rest?.map((tab) => badges[tab]).find(Boolean);
  const entries: View[] = dock.rest ? [...dock.tabs, 'all'] : dock.tabs;
  return (
    <nav className={styles.dock} aria-label={T.nav.label}>
      {entries.map((entry) => {
        const badge = entry === 'all' ? restBadge : badges[entry];
        return (
          <button
            key={entry}
            type="button"
            className={styles.tab}
            data-page={entry}
            aria-current={entry === marked ? 'page' : undefined}
            onClick={() => onSelect(entry)}
          >
            <span className={styles.icon}>
              {entry === 'all' ? <Icon name="apps" size={26} /> : <TabIcon tab={entry} usage={usage} size={26} />}
              {badge && <span className={styles.badge} style={{ background: badge }} />}
            </span>
            <span className={styles.name}>{entry === 'all' ? T.nav.all : tabName(entry, usage)}</span>
          </button>
        );
      })}
    </nav>
  );
}

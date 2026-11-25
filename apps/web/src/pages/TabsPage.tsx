// Which tabs are in the dock, and in which order: touch one, then the one to swap it with.
import type { Usage } from '@deskhub-mobile/protocol';
import { useState } from 'react';
import { tabName, TabIcon } from '../components/Dock.js';
import { dockOf, type Tab } from '../nav.js';
import { swapTabs } from '../tabOrder.js';
import { T } from '../text.js';
import styles from './TabsPage.module.css';

interface TabsProps {
  tabs: readonly Tab[];
  usage: Usage | null;
  /** null: the companion's order. */
  onChange: (tabs: readonly Tab[] | null) => void;
  onClose: () => void;
}

export function TabsPage({ tabs, usage, onChange, onClose }: TabsProps) {
  const [picked, setPicked] = useState<Tab | null>(null);
  const { tabs: inDock, rest } = dockOf(tabs);

  const touch = (tab: Tab) => {
    if (picked === null) return setPicked(tab);
    setPicked(null);
    if (picked !== tab) onChange(swapTabs(tabs, picked, tab));
  };

  const group = (title: string, list: readonly Tab[]) => (
    <section className={styles.group}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.tabs}>
        {list.map((tab) => (
          <button key={tab} type="button" className={styles.tab} aria-pressed={tab === picked} onClick={() => touch(tab)}>
            <TabIcon tab={tab} usage={usage} size={24} />
            <span className="ellipsis">{tabName(tab, usage)}</span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.hint}>{picked ? T.tabs.second(tabName(picked, usage)) : T.tabs.first}</p>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            setPicked(null);
            onChange(null);
          }}
        >
          {T.tabs.reset}
        </button>
        <button type="button" className={styles.done} onClick={onClose}>
          {T.tabs.done}
        </button>
      </header>
      {group(T.tabs.dock, inDock)}
      {rest && group(T.tabs.rest, rest)}
    </main>
  );
}

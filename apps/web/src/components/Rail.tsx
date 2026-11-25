// The navigation bar (build_rail in firmware/main/ui.c). Tabs that don't fit can be scrolled to.
import { useEffect, useRef, useState } from 'react';
import type { Link } from '../connection.js';
import { scrolledTab, TABS, type Tab } from '../nav.js';
import { Icon } from './Icon.js';
import styles from './Rail.module.css';

interface RailProps {
  tabs: readonly Tab[];
  current: Tab;
  onSelect: (tab: Tab) => void;
  /** The colours of the dots on tabs. */
  badges: Readonly<Partial<Record<Tab, string | null>>>;
  /** Shown instead of a tab's icon. */
  texts: Readonly<Partial<Record<Tab, string | null>>>;
  link: Link;
  online: boolean;
}

export function Rail({ tabs, current, onSelect, badges, texts, link, online }: RailProps) {
  const list = useRef<HTMLDivElement>(null);
  /** Whether there are tabs beyond the list's start and end. */
  const [more, setMore] = useState({ before: false, after: false });

  useEffect(() => {
    const element = list.current!;
    const measure = () => {
      const before = element.scrollTop + element.scrollLeft > 1;
      const beyond =
        element.scrollHeight - element.clientHeight + element.scrollWidth - element.clientWidth >
        element.scrollTop + element.scrollLeft + 1;
      setMore((old) => (old.before === before && old.after === beyond ? old : { before, after: beyond }));
    };
    const showCurrent = () => {
      const vertical = getComputedStyle(element).flexDirection === 'column';
      const length = scrolledTab(vertical ? element.clientHeight : element.clientWidth, tabs.length);
      if (length === null) element.style.removeProperty('--tab');
      else element.style.setProperty('--tab', `${length}px`);
      element.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      measure();
    };
    showCurrent();
    // It may turn, or tabs may come and go.
    const observer = new ResizeObserver(showCurrent);
    observer.observe(element);
    element.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, [current, tabs.length]);

  return (
    <nav className={styles.rail}>
      <div ref={list} className={styles.tabs} data-before={more.before || undefined} data-after={more.after || undefined}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={styles.tab}
            aria-label={TABS[tab].label}
            aria-current={tab === current ? 'page' : undefined}
            onClick={() => onSelect(tab)}
          >
            {texts[tab] ? <span className={styles.text}>{texts[tab]}</span> : <Icon name={TABS[tab].icon} size={32} />}
            {badges[tab] && <span className={styles.badge} style={{ background: badges[tab] }} />}
          </button>
        ))}
      </div>
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

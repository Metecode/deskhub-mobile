// Shortcuts: the companion's tiles. The phone only knows how they look; a tap sends the
// tile's index back to the PC (firmware/main/ui_shortcuts.c).
import { useEffect, useState, type CSSProperties } from 'react';
import { Empty } from '../components/Empty.js';
import { Icon } from '../components/Icon.js';
import { isOnline, type BridgeState, type Connection } from '../connection.js';
import { tileIcon } from '../icons.js';
import { CONFIRM_MS, needsConfirming, tileColumns } from '../shortcuts.js';
import { statusHint } from '../status.js';
import { T } from '../text.js';
import styles from './ShortcutsPage.module.css';

export function ShortcutsPage({ state, connection }: { state: BridgeState; connection: Connection }) {
  const { tiles, lit } = state;
  /** The tile that waits for its second touch. */
  const [armed, setArmed] = useState<number | null>(null);
  useEffect(() => {
    if (armed === null) return;
    const timer = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  // Others may have come in its place.
  useEffect(() => setArmed(null), [tiles]);

  if (tiles.length === 0)
    return <Empty icon="grid_view" title={T.shortcuts.none} hint={statusHint(state) || T.shortcuts.add} />;

  const cols = tileColumns(tiles.length);
  const rows = Math.ceil(tiles.length / cols);
  const online = isOnline(state);
  const touch = (id: number, icon: string) => {
    if (needsConfirming(icon) && armed !== id) return setArmed(id);
    setArmed(null);
    connection.send({ type: 'shortcut', id });
  };
  return (
    <main
      className={`${styles.grid} ${rows > 2 ? styles.compact : ''}`}
      style={{ '--cols': cols, '--rows': rows } as CSSProperties}
    >
      {tiles.map((tile, id) => (
        <button
          key={id}
          type="button"
          className={`${styles.tile} ${lit.has(id) ? styles.lit : ''}`}
          style={{ '--tint': tile.color } as CSSProperties}
          data-armed={armed === id || undefined}
          disabled={!online}
          onClick={() => touch(id, tile.icon)}
        >
          <span className={styles.icon}>
            <Icon name={tileIcon(tile.icon)} size={rows > 2 ? 40 : 56} />
          </span>
          <span className={styles.label}>{armed === id ? T.shortcuts.again : tile.label}</span>
        </button>
      ))}
    </main>
  );
}

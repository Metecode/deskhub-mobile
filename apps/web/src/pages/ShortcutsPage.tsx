// Shortcuts: the companion's tiles. The phone only knows how they look; a tap sends the
// tile's index back to the PC (firmware/main/ui_shortcuts.c).
import type { CSSProperties } from 'react';
import { Empty } from '../components/Empty.js';
import { Icon } from '../components/Icon.js';
import { isOnline, type BridgeState, type Connection } from '../connection.js';
import { tileIcon } from '../icons.js';
import { statusHint } from '../status.js';
import { T } from '../text.js';
import styles from './ShortcutsPage.module.css';

/** Columns for `n` tiles. */
const columns = (n: number) => (n <= 4 ? 2 : n <= 6 ? 3 : 4);

export function ShortcutsPage({ state, connection }: { state: BridgeState; connection: Connection }) {
  const { tiles, lit } = state;
  if (tiles.length === 0)
    return <Empty icon="grid_view" title={T.shortcuts.none} hint={statusHint(state) || T.shortcuts.add} />;

  const cols = columns(tiles.length);
  const rows = Math.ceil(tiles.length / cols);
  const online = isOnline(state);
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
          disabled={!online}
          onClick={() => connection.send({ type: 'shortcut', id })}
        >
          <span className={styles.icon}>
            <Icon name={tileIcon(tile.icon)} size={rows > 2 ? 40 : 56} />
          </span>
          <span className={styles.label}>{tile.label}</span>
        </button>
      ))}
    </main>
  );
}

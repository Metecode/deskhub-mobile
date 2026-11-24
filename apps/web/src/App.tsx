import { useSyncExternalStore } from 'react';
import styles from './App.module.css';
import { StatusBadge } from './components/StatusBadge.js';
import { TokenForm } from './components/TokenForm.js';
import type { Connection } from './connection.js';
import { StatsPage } from './pages/StatsPage.js';
import { saveToken } from './token.js';

export function App({ connection }: { connection: Connection }) {
  const state = useSyncExternalStore(connection.subscribe, connection.getState);

  if (state.link === 'bad_token') {
    return (
      <TokenForm
        onSubmit={(token) => {
          saveToken(token);
          connection.setToken(token);
        }}
      />
    );
  }
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.caption}>PC STATS</h1>
        <StatusBadge link={state.link} pcOnline={state.pcOnline} />
      </header>
      <StatsPage state={state} />
    </div>
  );
}

import { useState } from 'react';
import styles from './TokenForm.module.css';

export function TokenForm({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [token, setToken] = useState('');
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (token.trim()) onSubmit(token.trim());
      }}
    >
      <h1 className={styles.title}>Connect this screen</h1>
      <p className={styles.hint}>Open the link the bridge prints on your PC, or type CLIENT_TOKEN from its .env file.</p>
      <div className={styles.row}>
        <input
          className={styles.input}
          aria-label="Client token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className={styles.button}>Connect</button>
      </div>
    </form>
  );
}

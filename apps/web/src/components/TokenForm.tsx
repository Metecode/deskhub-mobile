import { useState } from 'react';
import { T } from '../text.js';
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
      <h1 className={styles.title}>{T.token.title}</h1>
      <p className={styles.hint}>{T.token.hint}</p>
      <div className={styles.row}>
        <input
          className={styles.input}
          aria-label={T.token.label}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className={styles.button}>{T.token.connect}</button>
      </div>
    </form>
  );
}

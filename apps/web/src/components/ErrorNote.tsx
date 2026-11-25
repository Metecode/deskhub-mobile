// Instead of a blank screen when something on the page fails.
import { Component, useEffect, useState, type ReactNode } from 'react';
import { describeError } from '../diagnostics.js';
import { ERROR_MS, takeErrorReload } from '../reload.js';
import styles from './ErrorNote.module.css';

interface NoteProps {
  error: unknown;
  /** Whether a reload would disturb nothing. */
  calm: () => boolean;
}

function Note({ error, calm }: NoteProps) {
  /** It reloaded too often already. */
  const [given, setGiven] = useState(false);
  useEffect(() => {
    const since = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - since < ERROR_MS || !calm()) return;
      clearInterval(timer);
      if (takeErrorReload(Date.now())) location.reload();
      else setGiven(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [calm]);
  return (
    <div className={styles.note} role="alert">
      <p className={styles.title}>Something went wrong here</p>
      <p className={styles.text}>{describeError(error)}</p>
      <button type="button" className={styles.button} onClick={() => location.reload()}>
        Reload
      </button>
      {given && <p className={styles.text}>It reloaded several times already and won&apos;t by itself for now.</p>}
    </div>
  );
}

interface BoundaryProps {
  children: ReactNode;
  calm: () => boolean;
  onError: (e: unknown) => void;
}

/** Give it a key that changes with what is in it, so that only that is lost. */
export class ErrorBoundary extends Component<BoundaryProps, { failed: boolean; error: unknown }> {
  override state = { failed: false, error: undefined as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    const { children, calm } = this.props;
    return this.state.failed ? <Note error={this.state.error} calm={calm} /> : children;
  }
}

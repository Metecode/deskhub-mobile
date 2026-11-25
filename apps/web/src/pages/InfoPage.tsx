// Diagnostics. Opened with the status icons, or with /#info.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isOnline, type BridgeState } from '../connection.js';
import { browserName, tryServiceWorker, type ErrorStore } from '../diagnostics.js';
import { formatClock, formatDuration } from '../time.js';
import type { WakeLockState, WakeLockStore } from '../wakeLock.js';
import styles from './InfoPage.module.css';

const FLAG = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';

const LINKS: Readonly<Record<BridgeState['link'], string>> = {
  connecting: 'connecting',
  open: 'connected',
  bad_token: 'token missing or refused',
  bad_origin: 'this address is not allowed',
};

type Mark = 'good' | 'bad' | undefined;

function Row({ label, mark, children }: { label: string; mark?: Mark; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd data-mark={mark}>{children}</dd>
    </div>
  );
}

function wakeLockText(state: WakeLockState, now: number): [string, Mark] {
  switch (state.status) {
    case 'unavailable':
      return ['not available', 'bad'];
    case 'off':
      return ['available, off', undefined];
    case 'waiting':
      return ['waiting', undefined];
    case 'held':
      return [`on for ${formatDuration(Math.max(0, now - Math.floor(state.since / 1000)))}`, 'good'];
    case 'refused':
      return [state.reason, 'bad'];
  }
}

interface InfoPageProps {
  state: BridgeState;
  wakeLock: WakeLockStore;
  errors: ErrorStore;
  /** Epoch seconds. */
  now: number;
  onClose: () => void;
}

export function InfoPage({ state, wakeLock, errors, now, onClose }: InfoPageProps) {
  const lock = useSyncExternalStore(wakeLock.subscribe, wakeLock.getState);
  const error = useSyncExternalStore(errors.subscribe, errors.getState);
  /** undefined while it is being tried. */
  const [worker, setWorker] = useState<string | null>();

  useEffect(() => {
    let gone = false;
    void tryServiceWorker().then((result) => {
      if (!gone) setWorker(result);
    });
    return () => {
      gone = true;
    };
  }, []);

  const [lockText, lockMark] = wakeLockText(lock, now);
  const online = isOnline(state);
  const on = lock.status !== 'off' && lock.status !== 'unavailable';
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Diagnostics</h1>
        {lock.status !== 'unavailable' && (
          <button type="button" className={styles.button} onClick={on ? wakeLock.stop : wakeLock.start}>
            {on ? 'Let the screen sleep' : 'Keep the screen on'}
          </button>
        )}
        <button type="button" className={styles.button} onClick={() => location.reload()}>
          Reload
        </button>
        <button type="button" className={styles.button} onClick={onClose}>
          Close
        </button>
      </header>
      {!isSecureContext && (
        <p className={styles.hint}>
          Without a secure context the screen can&apos;t be kept on and the page doesn&apos;t open without the PC. In
          Chrome, open <code>{FLAG}</code>, enter <code>{location.origin}</code>, choose Enabled and relaunch.
        </p>
      )}
      <dl className={styles.rows}>
        <Row label="Address">{location.origin}</Row>
        <Row label="Secure context" mark={isSecureContext ? 'good' : 'bad'}>
          {isSecureContext ? 'yes' : 'no'}
        </Row>
        <Row label="Wake lock" mark={lockMark}>
          {lockText}
        </Row>
        <Row label="Service worker" mark={worker === undefined ? undefined : worker === null ? 'good' : 'bad'}>
          {worker === undefined ? 'trying' : (worker ?? 'works')}
        </Row>
        <Row label="Bridge" mark={state.link === 'open' ? 'good' : 'bad'}>
          {LINKS[state.link]}
        </Row>
        <Row label="PC" mark={online ? 'good' : undefined}>
          {online ? 'online' : 'offline'}
        </Row>
        <Row label="Browser">{browserName(navigator.userAgent)}</Row>
        <Row label="Screen">
          {innerWidth} x {innerHeight}, {Math.round(devicePixelRatio * 100) / 100} pixels each
          {document.fullscreenElement ? ', fullscreen' : ''}
        </Row>
        <Row label="Build">{__BUILD__}</Row>
        <Row label="Last error" mark={error ? 'bad' : undefined}>
          {error ? `${formatClock(Math.floor(error.at / 1000))}  ${error.text}` : 'none'}
        </Row>
      </dl>
    </main>
  );
}

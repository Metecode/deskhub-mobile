// Diagnostics. Opened with the status icons, or with /#info.
import { useSyncExternalStore, type ReactNode } from 'react';
import { isOnline, type BridgeState } from '../connection.js';
import { browserName, type ErrorStore } from '../diagnostics.js';
import type { OfflineState, OfflineStore } from '../offline.js';
import type { LinkState } from '../linkQuality.js';
import type { SpeechState, SpeechStore } from '../speech.js';
import { formatNumber, T } from '../text.js';
import { formatClock, formatDuration } from '../time.js';
import type { WakeLockState, WakeLockStore } from '../wakeLock.js';
import styles from './InfoPage.module.css';

const FLAG = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';

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
      return [T.info.unavailable, 'bad'];
    case 'off':
      return [T.info.off, undefined];
    case 'waiting':
      return [T.info.waiting, undefined];
    case 'held':
      return [T.info.held(formatDuration(Math.max(0, now - Math.floor(state.since / 1000)))), 'good'];
    case 'refused':
      return [state.reason, 'bad'];
  }
}

function offlineText(state: OfflineState): [string, Mark] {
  switch (state.status) {
    case 'unavailable':
      return [T.info.unavailable, 'bad'];
    case 'off':
      return [T.info.off, undefined];
    case 'starting':
      return [T.info.starting, undefined];
    case 'active':
      return [T.info.active, 'good'];
    case 'failed':
      return [state.reason, 'bad'];
  }
}

interface InfoPageProps {
  state: BridgeState;
  link: LinkState;
  wakeLock: WakeLockStore;
  offline: OfflineStore;
  errors: ErrorStore;
  speech: SpeechStore;
  /** Epoch seconds. */
  now: number;
  onTabs: () => void;
  onClose: () => void;
}

function voiceText(voice: SpeechState): [string, Mark] {
  if (!voice.supported) return [T.speech.unsupported, 'bad'];
  if (!voice.voice) return [T.speech.noVoice, 'bad'];
  if (voice.error) return [T.speech.failed(voice.error), 'bad'];
  const { name, lang, local } = voice.voice;
  return [
    `${T.speech.voiceOf(name, lang, local)}; ${T.speech.turkishVoices(voice.turkishVoices)}; ${T.speech.rate(voice.rate)}`,
    'good',
  ];
}

export function InfoPage({ state, link, wakeLock, offline, errors, speech, now, onTabs, onClose }: InfoPageProps) {
  const [speechText, speechMark] = voiceText(useSyncExternalStore(speech.subscribe, speech.getState));
  const lock = useSyncExternalStore(wakeLock.subscribe, wakeLock.getState);
  const error = useSyncExternalStore(errors.subscribe, errors.getState);
  const worker = useSyncExternalStore(offline.subscribe, offline.getState);
  const [lockText, lockMark] = wakeLockText(lock, now);
  const [workerText, workerMark] = offlineText(worker);
  const online = isOnline(state);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{T.info.title}</h1>
        <button type="button" className={styles.button} onClick={onTabs}>
          {T.tabs.open}
        </button>
        <button type="button" className={styles.button} onClick={() => location.reload()}>
          {T.info.reload}
        </button>
        <button type="button" className={styles.button} onClick={onClose}>
          {T.info.close}
        </button>
      </header>
      {!isSecureContext && (
        <p className={styles.hint}>
          {T.info.hint[0]}
          <code>{FLAG}</code>
          {T.info.hint[1]}
          <code>{location.origin}</code>
          {T.info.hint[2]}
        </p>
      )}
      <dl className={styles.rows}>
        <Row label={T.info.address}>{location.origin}</Row>
        <Row label={T.info.secure} mark={isSecureContext ? 'good' : 'bad'}>
          {isSecureContext ? T.info.yes : T.info.no}
        </Row>
        <Row label={T.info.wakeLock} mark={lockMark}>
          {lockText}
        </Row>
        <Row label={T.info.worker} mark={workerMark}>
          {workerText}
        </Row>
        <Row label={T.info.bridge} mark={state.link === 'open' ? 'good' : 'bad'}>
          {T.info.links[state.link]}
        </Row>
        <Row label={T.info.answer} mark={link.ms === null ? undefined : link.level === 'good' ? 'good' : 'bad'}>
          {link.ms === null ? T.none : T.info.answerTime(Math.round(link.ms), link.lost)}
        </Row>
        <Row label={T.info.pc} mark={online ? 'good' : undefined}>
          {online ? T.info.online : T.info.offline}
        </Row>
        <Row label={T.speech.voice} mark={speechMark}>
          {speechText}
        </Row>
        <Row label={T.info.browser}>{browserName(navigator.userAgent)}</Row>
        <Row label={T.info.screen}>
          {T.info.screenSize(innerWidth, innerHeight, formatNumber(devicePixelRatio, 2))}
          {document.fullscreenElement ? `, ${T.info.fullscreen}` : ''}
        </Row>
        <Row label={T.info.build}>
          {__BUILD__}
          {state.build && state.build !== __BUILD__ && `, ${T.info.bridgeBuild(state.build)}`}
        </Row>
        <Row label={T.info.lastError} mark={error ? 'bad' : undefined}>
          {error ? `${formatClock(Math.floor(error.at / 1000))}  ${error.text}` : T.info.noError}
        </Row>
      </dl>
    </main>
  );
}

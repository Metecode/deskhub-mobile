// The morning bulletin: what Codex wrote, the bridge's portfolio, its checks, and reading it aloud.
import type { BulletinMessage, BulletinNote, Portfolio } from '@deskhub-mobile/protocol';
import { useSyncExternalStore } from 'react';
import { chipName, hasBulletin, readingOf, sectionId, sectionsOf, splitAtPortfolio } from '../bulletin.js';
import { BulletinMarkdown } from '../components/BulletinMarkdown.js';
import { Icon } from '../components/Icon.js';
import { PortfolioTable } from '../components/PortfolioTable.js';
import { RATES, type SpeechStore } from '../speech.js';
import { T } from '../text.js';
import { formatClock, formatDuration, formatShortDate } from '../time.js';
import styles from './BulletinPage.module.css';

interface BulletinProps {
  bulletin: BulletinMessage | null;
  speech: SpeechStore;
  /** Epoch seconds. */
  now: number;
  onRetry: () => void;
}

function noteText(note: BulletinNote): string {
  const n = T.bulletin.notes;
  switch (note.code) {
    case 'price_unverified':
      return n.price_unverified(note.ticker);
    case 'split_after':
      return n.split_after(note.ticker);
    default:
      return n[note.code];
  }
}

const dateOf = (day: string) => formatShortDate(new Date(`${day}T12:00:00`).getTime() / 1000);

function Status({ bulletin, now, onRetry }: Pick<BulletinProps, 'bulletin' | 'now' | 'onRetry'>) {
  if (bulletin?.state === 'running') {
    const since = Math.max(0, now - Math.floor((bulletin.startedAt ?? now * 1000) / 1000));
    return (
      <p className={styles.status} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        {T.bulletin.running(formatDuration(since))}
      </p>
    );
  }
  if (bulletin?.state !== 'failed') return null;
  const waitUntil = Math.ceil((bulletin.retryAt ?? 0) / 1000);
  return (
    <div className={styles.failed} role="alert">
      <p className={styles.failedTitle}>{T.bulletin.failed}</p>
      <p>{bulletin.error ? T.bulletin.errors[bulletin.error] : ''}</p>
      {now >= waitUntil ? (
        <button type="button" className={styles.pill} onClick={onRetry}>
          <Icon name="replay" size={18} />
          {T.bulletin.retry}
        </button>
      ) : (
        <p className={styles.muted}>{T.bulletin.retryAt(formatClock(waitUntil))}</p>
      )}
    </div>
  );
}

/** The bulletin, with the bridge's table in place of its portfolio section, or first when it has none. */
function Text({ markdown, portfolio }: { markdown: string; portfolio: Portfolio | null }) {
  const split = portfolio ? splitAtPortfolio(markdown) : null;
  if (!portfolio) return <BulletinMarkdown markdown={markdown} />;
  if (!split)
    return (
      <>
        <PortfolioTable portfolio={portfolio} />
        <BulletinMarkdown markdown={markdown} />
      </>
    );
  return (
    <>
      <BulletinMarkdown markdown={split.before} />
      <PortfolioTable portfolio={portfolio} heading={{ id: sectionId(split.heading), title: split.heading.replace(/^\d+[.)]\s*/, '') }} />
      <BulletinMarkdown markdown={split.after} />
    </>
  );
}

export function BulletinPage({ bulletin, speech, now, onRetry }: BulletinProps) {
  const voice = useSyncExternalStore(speech.subscribe, speech.getState);
  const shown = hasBulletin(bulletin) ? bulletin : null;
  const sections = shown ? sectionsOf(shown.markdown) : [];
  const fresh = shown && bulletin?.state === 'ready';
  const madeAt = shown?.madeAt ? Math.floor(shown.madeAt / 1000) : null;

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{T.bulletin.title}</h1>
        <span className={styles.made}>
          {shown?.date && (fresh || !madeAt ? '' : `${T.bulletin.previous(dateOf(shown.date))} · `)}
          {madeAt && T.bulletin.made(formatShortDate(madeAt), formatClock(madeAt))}
        </span>
        {shown && voice.supported && (
          <>
            <button type="button" className={styles.listen} onClick={() => speech.play(readingOf(shown.markdown, false))}>
              <Icon name="volume_up" size={20} />
              {T.morning.listen}
            </button>
            <button type="button" className={styles.pill} onClick={() => speech.play(readingOf(shown.markdown, true))}>
              {T.speech.all}
            </button>
          </>
        )}
      </header>

      {sections.length > 0 && (
        <nav className={styles.chips} aria-label={T.bulletin.sections} data-no-swipe>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.chip}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
            >
              {chipName(s.title)}
            </button>
          ))}
        </nav>
      )}

      <div className={styles.body} data-dimmed={(shown && !fresh) || undefined}>
        <Status bulletin={bulletin} now={now} onRetry={onRetry} />
        {shown?.notes && shown.notes.length > 0 && (
          <ul className={styles.notes}>
            {shown.notes.map((note) => (
              <li key={`${note.code}${'ticker' in note ? note.ticker : ''}`}>{noteText(note)}</li>
            ))}
          </ul>
        )}
        {!shown && bulletin?.state !== 'running' && bulletin?.state !== 'failed' && <p className={styles.muted}>{T.bulletin.empty}</p>}
        {shown && <Text markdown={shown.markdown} portfolio={shown.portfolio ?? null} />}

        {voice.supported && (
          <footer className={styles.settings}>
            <div className={styles.setting}>
              <span>{T.speech.speed}</span>
              <div className={styles.rates} role="group" aria-label={T.speech.speed}>
                {RATES.map((rate) => (
                  <button key={rate} type="button" aria-pressed={voice.rate === rate} onClick={() => speech.setRate(rate)}>
                    {T.speech.rate(rate)}
                  </button>
                ))}
              </div>
            </div>
            <label className={styles.setting}>
              <span>{T.speech.firstTouch}</span>
              <input type="checkbox" checked={voice.firstTouch} onChange={(e) => speech.setFirstTouch(e.target.checked)} />
            </label>
            {!voice.voice && <p className={styles.muted}>{T.speech.noVoice}</p>}
          </footer>
        )}
      </div>
    </main>
  );
}

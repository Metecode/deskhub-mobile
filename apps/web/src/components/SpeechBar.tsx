// The bar while something is read aloud: the sentence being read, back, pause, forward, all, close.
import { useSyncExternalStore } from 'react';
import type { SpeechStore } from '../speech.js';
import { T } from '../text.js';
import { Icon } from './Icon.js';
import styles from './SpeechBar.module.css';

export function SpeechBar({ speech, onAll }: { speech: SpeechStore; onAll: (() => void) | null }) {
  const { playing } = useSyncExternalStore(speech.subscribe, speech.getState);
  if (!playing) return null;
  const share = (playing.index + 1) / playing.sentences.length;
  return (
    <div className={styles.bar} role="region" aria-label={T.speech.reading} data-no-swipe>
      <button type="button" className={styles.small} aria-label={T.speech.back} onClick={speech.back}>
        <Icon name="skip_previous" size={22} />
      </button>
      <button
        type="button"
        className={styles.main}
        aria-label={playing.paused ? T.speech.resume : T.speech.pause}
        onClick={playing.paused ? speech.resume : speech.pause}
      >
        <Icon name={playing.paused ? 'play_arrow' : 'pause'} size={26} />
      </button>
      <button type="button" className={styles.small} aria-label={T.speech.forward} onClick={speech.next}>
        <Icon name="skip_next" size={22} />
      </button>
      <div className={styles.text}>
        <p className={styles.sentence} aria-live="polite">
          {playing.sentences[playing.index]}
        </p>
        <p className={styles.title}>
          {T.speech.reading}: {playing.title}
        </p>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${share * 100}%` }} />
        </div>
      </div>
      {onAll && (
        <button type="button" className={styles.pill} onClick={onAll}>
          {T.speech.all}
        </button>
      )}
      <button type="button" className={styles.small} aria-label={T.speech.stop} onClick={speech.stop}>
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

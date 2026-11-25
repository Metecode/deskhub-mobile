// The timer's end, over everything (show_done in firmware/main/ui_timer.c).
import type { Sound } from '../sound.js';
import { timerName, type TimerStore } from '../timer.js';
import { Icon } from './Icon.js';
import styles from './TimesUp.module.css';

interface TimesUpProps {
  timer: TimerStore;
  total: number;
  sound: Sound;
  /** It lies above the dark layer, which doesn't get its touches. */
  onTouch: () => void;
}

export function TimesUp({ timer, total, sound, onTouch }: TimesUpProps) {
  return (
    <div className={styles.layer} role="alertdialog" aria-label="Time's up" onPointerDown={onTouch}>
      <section className={styles.card}>
        <Icon name="timer" size={80} color="var(--good)" />
        <h2 className={styles.title}>Time's up</h2>
        <p className={styles.name}>{timerName(total)}</p>
        <div className={styles.buttons}>
          <button
            type="button"
            onClick={() => {
              sound.unlock();
              timer.again();
            }}
          >
            Again
          </button>
          <button type="button" className={styles.done} onClick={timer.dismiss}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

// The timer's end, over everything (show_done in firmware/main/ui_timer.c).
import { useState } from 'react';
import { TIMES_UP_DIM_MS } from '../burnIn.js';
import type { Sound } from '../sound.js';
import { T } from '../text.js';
import { timerName, type TimerStore } from '../timer.js';
import { Icon } from './Icon.js';
import styles from './TimesUp.module.css';

interface TimesUpProps {
  timer: TimerStore;
  total: number;
  sound: Sound;
  /** Epoch seconds. */
  now: number;
  /** It lies above the dark layer, which doesn't get its touches. */
  onTouch: () => void;
}

export function TimesUp({ timer, total, sound, now, onTouch }: TimesUpProps) {
  /** When it came or was touched, ms. */
  const [since, setSince] = useState(Date.now);
  return (
    <div
      className={styles.layer}
      role="alertdialog"
      aria-label={T.timer.up}
      data-dim={now * 1000 - since >= TIMES_UP_DIM_MS || undefined}
      onPointerDown={() => {
        setSince(Date.now());
        onTouch();
      }}
    >
      <section className={styles.card}>
        <Icon name="timer" size={80} color="var(--good)" />
        <h2 className={styles.title}>{T.timer.up}</h2>
        <p className={styles.name}>{timerName(total)}</p>
        <div className={styles.buttons}>
          <button
            type="button"
            onClick={() => {
              sound.unlock();
              timer.again();
            }}
          >
            {T.timer.again}
          </button>
          <button type="button" className={styles.done} onClick={timer.dismiss}>
            {T.timer.done}
          </button>
        </div>
      </section>
    </div>
  );
}

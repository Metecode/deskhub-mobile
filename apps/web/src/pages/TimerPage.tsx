// The timer (firmware/main/ui_timer.c).
import { useSyncExternalStore } from 'react';
import { Icon } from '../components/Icon.js';
import type { Sound } from '../sound.js';
import { T } from '../text.js';
import { formatDuration } from '../time.js';
import { PRESETS, type TimerStore } from '../timer.js';
import styles from './TimerPage.module.css';

export function TimerPage({ timer, sound }: { timer: TimerStore; sound: Sound }) {
  const { status, total, left } = useSyncExternalStore(timer.subscribe, timer.getState);
  const running = status === 'running';
  // Empties as time runs out, to the thousandth as on the board.
  const value = Math.trunc((1000 * left) / total) / 10;

  return (
    <main className={styles.page}>
      <section className={styles.clock}>
        <div className={styles.ring}>
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <circle className={styles.track} cx="150" cy="150" r="142" />
            {value > 0 && (
              <circle
                className={styles.value}
                cx="150"
                cy="150"
                r="142"
                pathLength={100}
                strokeDasharray={`${value} 200`}
              />
            )}
          </svg>
          <p className={styles.time}>{formatDuration(left)}</p>
          <p className={styles.status}>{T.timer[status]}</p>
        </div>
      </section>
      <section className={`${styles.side} card`}>
        <h2 className="caption">{T.timer.minutes}</h2>
        <div className={styles.presets}>
          {PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={minutes * 60 === total}
              onClick={() => {
                sound.unlock();
                timer.choose(minutes);
              }}
            >
              {minutes}
            </button>
          ))}
        </div>
        <div className={styles.buttons}>
          <button type="button" className={styles.reset} aria-label={T.timer.reset} onClick={timer.reset}>
            <Icon name="replay" size={32} />
          </button>
          <button
            type="button"
            className={styles.go}
            aria-label={running ? T.timer.pause : T.timer.start}
            onClick={() => {
              // Its sound has to be prepared in a touch.
              sound.unlock();
              timer.toggle();
            }}
          >
            <Icon name={running ? 'pause' : 'play_arrow'} size={48} />
          </button>
        </div>
      </section>
    </main>
  );
}

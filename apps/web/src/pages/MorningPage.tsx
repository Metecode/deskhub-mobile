// Günaydın: once a day on Home, the morning in one place (docs/plan-phase6.md).
import { useSyncExternalStore } from 'react';
import { bulletinIsToday, closingLine, hasBulletin, sectionsOf } from '../bulletin.js';
import { BulletinMarkdown } from '../components/BulletinMarkdown.js';
import { Icon } from '../components/Icon.js';
import type { BridgeState } from '../connection.js';
import { firstEventToday, morningReading } from '../morning.js';
import type { SpeechStore } from '../speech.js';
import { T } from '../text.js';
import { formatClock } from '../time.js';
import type { WeatherState } from '../weather.js';
import { formatTemp, weatherColor, weatherIcon, weatherText } from '../weatherLook.js';
import styles from './MorningPage.module.css';

interface MorningProps {
  state: BridgeState;
  weather: WeatherState;
  speech: SpeechStore;
  /** Epoch seconds. */
  now: number;
  onOpen: () => void;
  onClose: () => void;
}

export function MorningPage({ state, weather: { weather }, speech, now, onOpen, onClose }: MorningProps) {
  const voice = useSyncExternalStore(speech.subscribe, speech.getState);
  const { bulletin } = state;
  const today = bulletinIsToday(bulletin, now * 1000) && hasBulletin(bulletin) ? bulletin : null;
  const glance = today ? sectionsOf(today.markdown).find((s) => /bir bakışta/i.test(s.title)) : undefined;
  const step = today ? closingLine(today.markdown) : '';
  const event = firstEventToday(state.events.events, now);
  const reminders = (state.reminders?.reminders ?? []).filter((r) => !r.done);
  const day = weather?.days[0];

  const listen = () =>
    speech.play(morningReading({ weather, events: state.events.events, reminders, bulletin, now }));

  return (
    <main className={styles.page}>
      <h1 className={styles.hello}>{T.morning.hello}</h1>
      <ul className={styles.day}>
        {weather && (
          <li>
            <Icon name={weatherIcon(weather.code, weather.isDay)} size={26} color={weatherColor(weather.code, weather.isDay)} />
            <span>
              {formatTemp(weather.temp)}, {weatherText(weather.code)}
              {day && <span className={styles.muted}> · {T.morning.hiLo(formatTemp(day.hi), formatTemp(day.lo))}</span>}
            </span>
          </li>
        )}
        <li>
          <Icon name="event" size={24} color="var(--calendar-color)" />
          <span>{event ? T.morning.firstEvent(event.allDay ? '' : formatClock(event.start), event.title) : T.morning.noEvents}</span>
        </li>
        {reminders.map((r) => (
          <li key={r.id}>
            <Icon name="star" size={24} color="var(--accent)" />
            <span>{r.title}</span>
          </li>
        ))}
      </ul>

      <div className={styles.glance}>
        {glance ? (
          <BulletinMarkdown markdown={glance.body} />
        ) : (
          bulletin?.state === 'running' && <p className={styles.muted}>{T.morning.writing}</p>
        )}
      </div>
      {step && <p className={styles.step}>→ {step}</p>}

      <div className={styles.buttons}>
        {voice.supported && (
          <button type="button" className={styles.listen} onClick={listen}>
            <Icon name="volume_up" size={20} />
            {T.morning.listen}
          </button>
        )}
        {today && (
          <button type="button" className={styles.pill} onClick={onOpen}>
            {T.morning.open}
          </button>
        )}
        <button type="button" className={styles.pill} onClick={onClose}>
          {T.morning.close}
        </button>
      </div>
    </main>
  );
}

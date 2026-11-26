// What is on every page: the time, the weather, the next event, the timer, an alert, the connection.
import type { Alert, TodayReminder, Values } from '@deskhub-mobile/protocol';
import type { CSSProperties } from 'react';
import { notOver, untilText } from '../agenda.js';
import { kindText, panelText } from '../alerts.js';
import { isOnline, type BridgeState } from '../connection.js';
import type { LinkState } from '../linkQuality.js';
import { T } from '../text.js';
import { formatClock, formatDate, formatDuration } from '../time.js';
import type { TimerState } from '../timer.js';
import type { WeatherState } from '../weather.js';
import { formatTemp, weatherColor, weatherIcon, weatherText } from '../weatherLook.js';
import { AgentIcon } from './AgentIcon.js';
import { Icon } from './Icon.js';
import { LinkIcon } from './LinkIcon.js';
import styles from './Panel.module.css';
import { ReminderCard } from './ReminderCard.js';

interface PanelProps {
  state: BridgeState;
  weather: WeatherState;
  alert: Alert | null;
  onAlertAction: (action: 'focus' | 'dismiss') => void;
  timer: TimerState;
  link: LinkState;
  /** Epoch seconds. */
  now: number;
  /** null: there is no such page. */
  onWeather: (() => void) | null;
  onCalendar: (() => void) | null;
  onTimer: (() => void) | null;
  onLink: () => void;
  /** Today's reminder that is still to do, in place of the next event (phase 6). */
  reminder: {
    item: TodayReminder;
    onSave: (values: Values) => void;
    onLater: () => void;
    onChart: () => void;
  } | null;
}

function AlertCard({ state, alert, onAction }: { state: BridgeState; alert: Alert; onAction: PanelProps['onAlertAction'] }) {
  const { title, detail } = panelText(alert);
  return (
    <section className={styles.alert} role="alert" data-permission={alert.permission || undefined}>
      <p className={styles.alertHead}>
        <AgentIcon usage={state.usage} size={22} />
        <span>{alert.project || kindText(alert)}</span>
      </p>
      <p className={styles.alertTitle}>{title}</p>
      <p className={styles.alertDetail}>{detail}</p>
      <div className={styles.alertButtons}>
        <button type="button" onClick={() => onAction('dismiss')}>
          {T.alert.notNow}
        </button>
        <button type="button" className={styles.main} onClick={() => onAction('focus')}>
          {T.alert.show}
        </button>
      </div>
    </section>
  );
}

export function Panel(props: PanelProps) {
  const { state, weather: { settings, weather }, alert, timer, link, now } = props;
  const event = notOver(state.events.events, now)[0];
  const connected = state.link === 'open';
  const pcMissing = connected && !isOnline(state);
  const level = connected ? link.level : null;
  return (
    <aside className={styles.panel} aria-label={T.panel.label}>
      <div className={styles.clock}>
        <p className={styles.time}>{formatClock(now)}</p>
        <p className={styles.date}>{formatDate(now)}</p>
      </div>

      {timer.status !== 'idle' && (
        <button
          type="button"
          className={styles.timer}
          aria-label={props.onTimer ? T.panel.openTimer : T.panel.timer}
          disabled={!props.onTimer}
          onClick={() => props.onTimer?.()}
        >
          <Icon name={timer.status === 'paused' ? 'pause' : 'timer'} size={22} color="var(--good)" />
          <span>{formatDuration(timer.left)}</span>
        </button>
      )}

      {alert ? (
        <AlertCard state={state} alert={alert} onAction={props.onAlertAction} />
      ) : (
        <>
          {settings && weather && (
            <button
              type="button"
              className={styles.weather}
              aria-label={T.panel.openWeather}
              disabled={!props.onWeather}
              onClick={() => props.onWeather?.()}
            >
              <Icon
                name={weatherIcon(weather.code, weather.isDay)}
                size={40}
                color={weatherColor(weather.code, weather.isDay)}
              />
              <span className={styles.weatherText}>
                <span className={styles.temp}>{formatTemp(weather.temp)}</span>
                <span className={styles.condition}>{weatherText(weather.code)}</span>
              </span>
            </button>
          )}
          {props.reminder ? (
            <ReminderCard
              reminder={props.reminder.item}
              onSave={props.reminder.onSave}
              onLater={props.reminder.onLater}
              onChart={props.reminder.onChart}
            />
          ) : props.onCalendar && (
            <button type="button" className={styles.next} aria-label={T.panel.openCalendar} onClick={props.onCalendar}>
              <span className={styles.nextLabel}>{event && event.start <= now && !event.allDay ? T.panel.live : T.panel.next}</span>
              {event ? (
                <>
                  <span className={styles.nextTitle} style={{ '--calendar': event.color } as CSSProperties}>
                    {event.title}
                  </span>
                  <span className={styles.nextWhen}>{untilText(event, now)}</span>
                </>
              ) : (
                <span className={styles.nextWhen}>{T.panel.noEvents}</span>
              )}
            </button>
          )}
        </>
      )}

      <button
        type="button"
        className={styles.link}
        aria-label={T.link.open(pcMissing ? T.pcOffline : T.link[level ?? 'none'])}
        onClick={props.onLink}
      >
        <LinkIcon level={level} pcMissing={pcMissing} />
      </button>
    </aside>
  );
}

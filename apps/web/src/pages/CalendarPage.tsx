// Calendar: upcoming events by day (firmware/main/ui_calendar.c).
import type { CalendarEvent } from '@deskhub-mobile/protocol';
import { Fragment } from 'react';
import { agenda, eventsSummary, isLive, notOver } from '../agenda.js';
import { Empty } from '../components/Empty.js';
import type { BridgeState } from '../connection.js';
import { statusHint } from '../status.js';
import { formatClock } from '../time.js';
import styles from './CalendarPage.module.css';

function EventRow({ event, now }: { event: CalendarEvent; now: number }) {
  const live = isLive(event, now);
  const detail = [event.location, event.calendar].filter(Boolean).join('  •  ');
  return (
    <li className={`${styles.event} ${live ? styles.live : ''}`} style={live ? { borderColor: event.color } : undefined}>
      <span className={styles.bar} style={{ background: event.color }} />
      <div className={styles.when}>
        {event.allDay ? (
          'All day'
        ) : (
          <>
            <span>{formatClock(event.start)}</span>
            <span>{formatClock(event.end)}</span>
          </>
        )}
      </div>
      <div className={styles.what}>
        <p className={styles.title}>{event.title}</p>
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
    </li>
  );
}

export function CalendarPage({ state, now }: { state: BridgeState; now: number }) {
  const { events } = state;
  const shown = notOver(events.events, now).length;
  const summary = eventsSummary(events, now, shown);
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Upcoming</h1>
      {shown === 0 ? (
        <Empty title={summary} hint={statusHint(state) || 'Add a calendar with deskhub-calendars on your PC'} />
      ) : (
        <div className={styles.list}>
          {agenda(events.events, now).map(({ day, title, events: list }) => (
            <Fragment key={day}>
              <h2 className={styles.day}>{title}</h2>
              <ul className={styles.events}>
                {list.map((event, i) => (
                  <EventRow key={i} event={event} now={now} />
                ))}
              </ul>
            </Fragment>
          ))}
          <p className={styles.end}>{summary}</p>
        </div>
      )}
    </main>
  );
}

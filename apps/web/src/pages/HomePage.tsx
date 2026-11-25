// Home: the companion's widgets on a 5 x 3 grid (firmware/main/ui_home.c).
import { visibleWidgets, WIDGET_PAGES, type GridItem, type Page } from '@deskhub-mobile/protocol';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { eventsSummary, eventWhen, notOver } from '../agenda.js';
import { CoverArt } from '../components/CoverArt.js';
import { Icon } from '../components/Icon.js';
import { isOnline, pcMedia, type BridgeState, type Connection } from '../connection.js';
import { coverOf } from '../cover.js';
import { formatPercent } from '../format.js';
import { useInnerHeight } from '../hooks.js';
import type { IconName } from '../icons.js';
import { statusHint } from '../status.js';
import { amPm, formatDate, formatDigits, HOUR12 } from '../time.js';
import { daysFrom, type WeatherState } from '../weather.js';
import { formatTemp, weatherColor, weatherIcon, weatherText } from '../weatherLook.js';
import styles from './HomePage.module.css';

interface HomeProps {
  state: BridgeState;
  weather: WeatherState;
  /** Epoch seconds. */
  now: number;
  connection: Connection;
  onOpen: (page: Page) => void;
}

function Header({ now }: { now: number }) {
  return (
    <header className={styles.header}>
      <span className={styles.headerTime}>{formatDigits(now)}</span>
      {HOUR12 && <span className={styles.headerAmPm}>{amPm(now)}</span>}
      <span className={styles.headerDate}>{formatDate(now)}</span>
    </header>
  );
}

function ClockWidget({ now }: { now: number }) {
  return (
    <div className={styles.clock}>
      <p className={styles.clockTime}>
        {formatDigits(now)}
        {HOUR12 && <span className={styles.clockAmPm}>{amPm(now)}</span>}
      </p>
      <p className={styles.clockDate}>{formatDate(now)}</p>
    </div>
  );
}

// The board's row heights, in its pixels (layout_events).
const EVENT_HEADER = 26;
const EVENT_PITCH = 60;
const EVENT_ROWS_MAX = 3;
const EVENT_LINE = 20;

function EventsWidget({ state, now }: { state: BridgeState; now: number }) {
  const box = useRef<HTMLDivElement>(null);
  const height = useInnerHeight(box);
  const fit = Math.floor((height - EVENT_HEADER + 4) / EVENT_PITCH);
  const shown = notOver(state.events.events, now).slice(0, Math.min(EVENT_ROWS_MAX, Math.max(1, fit)));
  const room = height - EVENT_HEADER - shown.length * EVENT_PITCH >= EVENT_LINE;
  return (
    <div ref={box} className={styles.events}>
      <p className={styles.caption}>UP NEXT</p>
      {shown.map((event, i) => (
        <div key={i} className={styles.event}>
          <span className={styles.eventBar} style={{ background: event.color }} />
          <p className={styles.eventTitle}>{event.title}</p>
          <p className={styles.eventWhen}>{eventWhen(event, now)}</p>
        </div>
      ))}
      {(room || shown.length === 0) && (
        <p className={styles.eventsEnd} data-indent={shown.length > 0 || undefined}>
          {eventsSummary(state.events, now, shown.length)}
        </p>
      )}
    </div>
  );
}

function WeatherWidget({ weather: { settings, weather }, now, tiny }: { weather: WeatherState; now: number; tiny: boolean }) {
  const today = weather && daysFrom(weather, now)[0];
  const text = weather ? weatherText(weather.code) : settings === null ? 'No location set' : 'Loading weather';
  return (
    <div className={styles.weather}>
      <Icon
        name={weather ? weatherIcon(weather.code, weather.isDay) : 'cloud'}
        size={tiny ? 32 : 80}
        color={weather ? weatherColor(weather.code, weather.isDay) : 'var(--dim)'}
      />
      <div className={styles.weatherText}>
        <p className={tiny ? styles.tinyTemp : styles.temp}>{weather ? formatTemp(weather.temp) : '--'}</p>
        {!tiny && <p>{text}</p>}
        {!tiny && today && (
          <p>
            H {formatTemp(today.hi)}&ensp;L {formatTemp(today.lo)}
          </p>
        )}
      </div>
    </div>
  );
}

function MediaWidget({ state, connection }: { state: BridgeState; connection: Connection }) {
  const pc = pcMedia(state);
  // The PC, or the media server while nothing plays on the PC (home_shows_server).
  const server = !pc.active && state.server.configured && state.server.now.active;
  const media = server ? state.server.now : pc;
  const online = isOnline(state);
  const cover = coverOf(media, server ? state.covers.server : state.covers.pc);
  return (
    <div className={styles.media}>
      <CoverArt
        cover={cover}
        icon={server ? 'movie' : 'music_note'}
        iconSize={32}
        className={server && cover ? styles.poster : styles.cover}
      />
      <div className={styles.mediaText}>
        <p className={styles.mediaTitle}>{media.active ? media.title : 'Nothing playing'}</p>
        <p className={styles.mediaArtist}>{media.active ? media.artist : online ? '' : 'PC offline'}</p>
      </div>
      {media.active && media.controls && (
        <button
          type="button"
          className={styles.play}
          aria-label={media.playing ? 'Pause' : 'Play'}
          disabled={!online}
          onClick={(e) => {
            e.stopPropagation();
            connection.sendMedia(server ? 'media_server' : 'media', 'toggle');
          }}
        >
          <Icon name={media.playing ? 'pause' : 'play_arrow'} size={24} />
        </button>
      )}
    </div>
  );
}

function StatsWidget({ state, tiny }: { state: BridgeState; tiny: boolean }) {
  const s = isOnline(state) ? state.stats : null;
  const rows = [
    { name: 'CPU', color: 'var(--cpu)', value: s && s.cpu },
    { name: 'GPU', color: 'var(--gpu)', value: s && s.gpu },
    { name: 'RAM', color: 'var(--ram)', value: s && (s.ramTotal > 0 ? (100 * s.ramUsed) / s.ramTotal : 0) },
  ];
  return (
    <div className={styles.stats}>
      {rows.map(({ name, color, value }) => (
        <div key={name} className={styles.stat}>
          <span className={styles.statName}>{name}</span>
          {!tiny && (
            <span className={styles.statTrack}>
              <span
                className={styles.statBar}
                style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%`, background: color }}
              />
            </span>
          )}
          <span className={styles.statValue}>{value === null ? '--' : formatPercent(value)}</span>
        </div>
      ))}
    </div>
  );
}

// Their pages come later. Labels from HOME_WIDGETS in pages.py.
const LATER: Readonly<Partial<Record<GridItem['widget'], readonly [IconName, string]>>> = {
  claude: ['auto_awesome', 'Claude limits'],
  printer: ['view_in_ar', '3D print progress'],
  game: ['sports_esports', 'Steam game'],
  net: ['public', 'Internet'],
  github: ['commit', 'GitHub contributions'],
};

function Placeholder({ widget }: { widget: GridItem['widget'] }) {
  const [icon, label] = LATER[widget] ?? ['apps', widget];
  return (
    <div className={styles.placeholder}>
      <Icon name={icon} size={24} />
      <p>{label}</p>
      <p className={styles.later}>Not available yet</p>
    </div>
  );
}

export function HomePage({ state, weather, now, connection, onOpen }: HomeProps) {
  const { home, layout } = state;
  const hint = state.link === 'bad_origin' ? statusHint(state) : '';

  function content({ widget, w }: GridItem): ReactNode {
    switch (widget) {
      case 'clock':
        return <ClockWidget now={now} />;
      case 'events':
        return <EventsWidget state={state} now={now} />;
      case 'weather':
        return <WeatherWidget weather={weather} now={now} tiny={w === 1} />;
      case 'media':
        return <MediaWidget state={state} connection={connection} />;
      case 'stats':
        return <StatsWidget state={state} tiny={w === 1} />;
      default:
        return <Placeholder widget={widget} />;
    }
  }

  return (
    <main className={styles.home}>
      {home.header && <Header now={now} />}
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.grid}>
        {visibleWidgets(home, layout.pages).map((item) => {
          const page = WIDGET_PAGES[item.widget];
          const opens = page && !LATER[item.widget] ? page : null;
          return (
            <section
              key={item.widget}
              className={`${styles.cell} ${item.widget === 'clock' ? '' : styles.card} ${opens ? styles.opens : ''}`}
              style={
                {
                  '--x': item.x + 1,
                  '--y': item.y + 1,
                  '--w': item.w,
                  '--h': item.h,
                } as CSSProperties
              }
              onClick={opens ? () => onOpen(opens) : undefined}
            >
              {content(item)}
            </section>
          );
        })}
      </div>
    </main>
  );
}

// Home: the companion's widgets on a 5 x 3 grid (firmware/main/ui_home.c), less what the panel shows.
import { WIDGET_PAGES, type GridItem, type Page } from '@deskhub-mobile/protocol';
import { useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { eventsSummary, eventWhen, notOver } from '../agenda.js';
import { AgentIcon } from '../components/AgentIcon.js';
import { Bar } from '../components/Bar.js';
import { ContributionChart } from '../components/ContributionChart.js';
import { CoverArt } from '../components/CoverArt.js';
import { Icon } from '../components/Icon.js';
import { Ring } from '../components/Ring.js';
import { isOnline, pcMedia, type BridgeState, type Connection } from '../connection.js';
import { coverOf } from '../cover.js';
import { formatPercent } from '../format.js';
import { homeGame, sessionSeconds, type LaunchStore } from '../games.js';
import { formatCount, homeStreak, homeTotal, tallChart, wideChart } from '../github.js';
import { useInnerSize } from '../hooks.js';
import { formatLatency, homeText, latencyColor } from '../internet.js';
import { homePrinter } from '../printers.js';
import { statusHint } from '../status.js';
import { PAGE_NAMES, T } from '../text.js';
import { formatClock, formatDate } from '../time.js';
import { agentColor, homeLimits } from '../usage.js';
import { daysFrom, type WeatherState } from '../weather.js';
import { formatTemp, weatherColor, weatherIcon, weatherText } from '../weatherLook.js';
import styles from './HomePage.module.css';

interface HomeProps {
  state: BridgeState;
  grid: readonly GridItem[];
  weather: WeatherState;
  /** Epoch seconds. */
  now: number;
  connection: Connection;
  launches: LaunchStore;
  onOpen: (page: Page) => void;
}

function ClockWidget({ now }: { now: number }) {
  return (
    <div className={styles.clock}>
      <p className={styles.clockTime}>{formatClock(now)}</p>
      <p className={styles.clockDate}>{formatDate(now)}</p>
    </div>
  );
}

const LIMITS = [T.usage.fiveHourShort, T.usage.weeklyShort] as const;

/** With room, rings; else bars. */
function ClaudeWidget({ state, now, w, h }: { state: BridgeState; now: number; w: number; h: number }) {
  const { usage } = state;
  const color = agentColor(usage);
  const limits = homeLimits(usage, isOnline(state), now);
  // One cell wide: just the 5-hour limit.
  const shown = w === 1 ? limits.slice(0, 1) : limits;
  const rings = h > 1 && w > 1;
  return (
    <div className={styles.claude} data-rings={rings || undefined} data-narrow={w < 3 || undefined}>
      {(w > 2 || rings) && w > 1 && <AgentIcon usage={usage} size={rings ? 44 : 38} />}
      {shown.map(({ pct, sub }, i) =>
        rings ? (
          <div key={i} className={styles.ringLimit}>
            <Ring percent={pct} color={pct !== null && pct >= 80 ? 'var(--bad)' : color} size={w > 2 ? 112 : 88} />
            <p className={styles.ringName}>{LIMITS[i]}</p>
            <p className={styles.sub}>{sub}</p>
          </div>
        ) : (
          <div key={i} className={styles.limit}>
            <p className={styles.limitHead}>
              <span>{LIMITS[i]}</span>
              <span className={styles.limitValue}>{pct === null ? T.none : formatPercent(pct)}</span>
            </p>
            <Bar value={pct ?? 0} color={pct !== null && pct >= 80 ? 'var(--bad)' : color} height={8} />
            <p className={styles.sub}>{sub}</p>
          </div>
        ),
      )}
    </div>
  );
}

function NetWidget({ state, now, tiny }: { state: BridgeState; now: number; tiny: boolean }) {
  const { net } = state;
  return (
    <div className={styles.spread}>
      <p className={styles.head}>
        <span className={styles.name} style={{ color: 'var(--cpu)' }}>
          {PAGE_NAMES.network}
        </span>
        {net && !tiny && (
          <span style={{ color: net.online ? 'var(--good)' : 'var(--bad)' }}>
            {net.online ? T.net.online : T.net.offline}
          </span>
        )}
      </p>
      <p className={styles.number} data-tiny={tiny || undefined} style={{ color: net ? latencyColor(net.latency) : undefined }}>
        {formatLatency(net && net.latency)}
      </p>
      {!tiny && (
        <p className={styles.sub}>{net ? homeText(net, now) : isOnline(state) ? T.waitingForPc : T.pcOffline}</p>
      )}
    </div>
  );
}

// The board's row heights, in its pixels (layout_events).
const EVENT_HEADER = 24;
const EVENT_PITCH = 50;
const EVENT_ROWS_MAX = 3;
const EVENT_LINE = 20;

function EventsWidget({ state, now }: { state: BridgeState; now: number }) {
  const box = useRef<HTMLDivElement>(null);
  const { height } = useInnerSize(box);
  const fit = Math.floor((height - EVENT_HEADER + 4) / EVENT_PITCH);
  const shown = notOver(state.events.events, now).slice(0, Math.min(EVENT_ROWS_MAX, Math.max(1, fit)));
  const room = height - EVENT_HEADER - shown.length * EVENT_PITCH >= EVENT_LINE;
  return (
    <div ref={box} className={styles.events}>
      <p className="caption" style={{ color: 'var(--calendar-color)' }}>{T.panel.next}</p>
      {shown.map((event, i) => (
        <div key={i} className={styles.event}>
          <span className={styles.dot} style={{ background: event.color }} />
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
  const text = weather ? weatherText(weather.code) : settings === null ? T.weather.noLocation : T.weather.loading;
  return (
    <div className={styles.weather}>
      <Icon
        name={weather ? weatherIcon(weather.code, weather.isDay) : 'cloud'}
        size={tiny ? 32 : 60}
        color={weather ? weatherColor(weather.code, weather.isDay) : 'var(--dim)'}
      />
      <div className={styles.weatherText}>
        <p className={styles.number}>{weather ? formatTemp(weather.temp) : T.none}</p>
        {!tiny && <p className={styles.sub}>{text}</p>}
        {!tiny && today && (
          <p className={styles.sub}>{T.weather.range(formatTemp(today.hi), formatTemp(today.lo))}</p>
        )}
      </div>
    </div>
  );
}

function MediaWidget({ state, connection, tall }: { state: BridgeState; connection: Connection; tall: boolean }) {
  const pc = pcMedia(state);
  // The PC, or the media server while nothing plays on the PC (home_shows_server).
  const server = !pc.active && state.server.configured && state.server.now.active;
  const media = server ? state.server.now : pc;
  const online = isOnline(state);
  const cover = coverOf(media, server ? state.covers.server : state.covers.pc);
  return (
    <div className={styles.media} data-tall={tall || undefined}>
      <CoverArt
        cover={cover}
        icon={server ? 'movie' : 'music_note'}
        iconSize={32}
        className={server && cover ? styles.poster : styles.cover}
      />
      <div className={styles.mediaRow}>
        <div className={styles.mediaText}>
          <p className={styles.mediaTitle}>{media.active ? media.title : T.media.nothing}</p>
          <p className={styles.sub}>{media.active ? media.artist : online ? '' : T.pcOffline}</p>
        </div>
        {media.active && media.controls && (
          <button
            type="button"
            className={styles.play}
            aria-label={media.playing ? T.media.pause : T.media.play}
            disabled={!online}
            onClick={(e) => {
              e.stopPropagation();
              connection.sendMedia(server ? 'media_server' : 'media', 'toggle');
            }}
          >
            <Icon name={media.playing ? 'pause' : 'play_arrow'} size={26} />
          </button>
        )}
      </div>
    </div>
  );
}

function StatsWidget({ state, w, h }: { state: BridgeState; w: number; h: number }) {
  const s = isOnline(state) ? state.stats : null;
  const rows = [
    { name: T.stats.cpu, color: 'var(--cpu)', value: s && s.cpu },
    { name: T.stats.gpu, color: 'var(--gpu)', value: s && s.gpu },
    { name: T.stats.ram, color: 'var(--ram)', value: s && (s.ramTotal > 0 ? (100 * s.ramUsed) / s.ramTotal : 0) },
  ];
  return (
    // One row high and wide: side by side.
    <div className={styles.stats} data-flat={(h === 1 && w > 3) || undefined} data-big={h > 1 || undefined} data-tiny={w === 1 || undefined}>
      {rows.map(({ name, color, value }) => (
        <div key={name} className={styles.stat}>
          <p className={styles.statHead}>
            <span className={styles.statName}>{name}</span>
            <span className={styles.statValue}>{value === null ? T.none : formatPercent(value)}</span>
          </p>
          <Bar value={value ?? 0} color={color} height={h > 1 ? 8 : 6} />
        </div>
      ))}
    </div>
  );
}

function PrinterWidget({ state, narrow }: { state: BridgeState; narrow: boolean }) {
  const { state: text, color, file, pct, info } = homePrinter(state.printers);
  return (
    <div className={styles.spread}>
      <p className={styles.head}>
        {!narrow && (
          <span className={styles.name} style={{ color: 'var(--vram)' }}>
            {T.printer.title}
          </span>
        )}
        <span className="ellipsis" style={{ color }}>
          {text}
        </span>
      </p>
      <div>
        <p className={styles.title}>{file}</p>
        <Bar value={pct} color={color} height={10} />
      </div>
      <p className={styles.sub}>{info}</p>
    </div>
  );
}

interface GameWidgetProps {
  state: BridgeState;
  connection: Connection;
  launches: LaunchStore;
  now: number;
}

function GameWidget({ state, connection, launches, now }: GameWidgetProps) {
  const launching = useSyncExternalStore(launches.subscribe, launches.getState);
  const { steam, gameCovers } = state;
  const online = isOnline(state);
  const session = steam ? sessionSeconds(steam, state, now) : 0;
  const { caption, sub, name } = homeGame(steam, session, online, now);
  const last = steam && !steam.playing ? steam.recent[0] : undefined;
  const shown = steam?.playing ?? last;
  const { thumb } = gameCovers;
  const cover = shown && thumb?.id === shown.appid ? thumb : null;
  return (
    <div className={styles.game}>
      <div className={styles.gameCover} style={cover ? { aspectRatio: `${cover.width} / ${cover.height}` } : undefined}>
        <CoverArt cover={cover} icon="sports_esports" iconSize={32} className={styles.gameArt} />
        {last && (
          <button
            type="button"
            className={styles.gamePlay}
            aria-label={T.games.play(last.name)}
            disabled={!online || launching !== null}
            onClick={(e) => {
              e.stopPropagation();
              launches.launch(last.appid, () => connection.send({ type: 'steam_launch', appid: last.appid }));
            }}
          >
            <Icon name="play_arrow" size={24} />
          </button>
        )}
      </div>
      <div className={styles.gameText}>
        <p className={styles.gameCaption} data-playing={steam?.playing ? true : undefined}>
          {last && launching === last.appid ? T.games.starting : caption}
        </p>
        <p className={styles.gameSub}>{sub}</p>
        <p className={styles.gameName}>{name}</p>
      </div>
    </div>
  );
}

const githubWhy = (state: BridgeState) => (isOnline(state) ? T.waitingForPc : T.pcOffline);

/** One row: the chart as high as the card, the numbers on its right. */
function WideGitHubWidget({ state, wide }: { state: BridgeState; wide: boolean }) {
  const { github } = state;
  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useInnerSize(box);
  return (
    <div className={styles.github}>
      <div ref={box} className={styles.githubChart}>
        {height > 0 && <ContributionChart github={github} {...wideChart(github, width - 2, height - 2)} />}
      </div>
      <div className={styles.githubSide} data-wide={wide || undefined}>
        <p className={styles.name} style={{ color: 'var(--good)' }}>
          {PAGE_NAMES.github}
        </p>
        <p className={styles.number}>{github ? formatCount(github.total) : T.none}</p>
        <p className={styles.sub}>{github ? homeStreak(github) : githubWhy(state)}</p>
        {github && github.privateCount > 0 && (
          <p className={styles.sub}>{T.github.private(formatCount(github.privateCount))}</p>
        )}
      </div>
    </div>
  );
}

/** Two rows: months over the chart, numbers under it. */
function TallGitHubWidget({ state }: { state: BridgeState }) {
  const { github } = state;
  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useInnerSize(box);
  const numbers = [
    [T.github.today, github?.today],
    [T.github.thisWeek, github?.week],
    [T.github.dayStreak, github?.streak],
  ] as const;
  return (
    <div className={styles.spread}>
      <p className={styles.head}>
        <span className={styles.name} style={{ color: 'var(--good)' }}>
          {PAGE_NAMES.github}
        </span>
        <span className="ellipsis">{github ? homeTotal(github) : githubWhy(state)}</span>
      </p>
      <div ref={box} className={styles.githubTall}>
        {height > 0 && <ContributionChart github={github} {...tallChart(github, width - 2, height - 22)} months />}
      </div>
      <div className={styles.githubNumbers}>
        {numbers.map(([what, n]) => (
          <p key={what}>
            <span>{n === undefined ? T.none : formatCount(n)}</span>
            {what}
          </p>
        ))}
      </div>
    </div>
  );
}

const place = ({ x, y, w, h }: GridItem) => ({ '--x': x + 1, '--y': y + 1, '--w': w, '--h': h }) as CSSProperties;

export function HomePage({ state, grid, weather, now, connection, launches, onOpen }: HomeProps) {
  const { layout } = state;
  const hint = state.link === 'bad_origin' ? statusHint(state) : '';

  function content({ widget, w, h }: GridItem): ReactNode {
    switch (widget) {
      case 'clock':
        return <ClockWidget now={now} />;
      case 'claude':
        return <ClaudeWidget state={state} now={now} w={w} h={h} />;
      case 'events':
        return <EventsWidget state={state} now={now} />;
      case 'weather':
        return <WeatherWidget weather={weather} now={now} tiny={w === 1} />;
      case 'media':
        return <MediaWidget state={state} connection={connection} tall={h > 1 || w === 1} />;
      case 'stats':
        return <StatsWidget state={state} w={w} h={h} />;
      case 'net':
        return <NetWidget state={state} now={now} tiny={w === 1} />;
      case 'printer':
        return <PrinterWidget state={state} narrow={w < 3} />;
      case 'game':
        return <GameWidget state={state} connection={connection} launches={launches} now={now} />;
      case 'github':
        return h > 1 ? <TallGitHubWidget state={state} /> : <WideGitHubWidget state={state} wide={w >= 4} />;
    }
  }

  return (
    <main className={styles.home}>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.grid}>
        {grid.map((item) => {
          const page = WIDGET_PAGES[item.widget];
          const opens = page ?? (item.widget === 'github' && layout.pages.includes('github') ? 'github' : null);
          return (
            <section
              key={item.widget}
              className={`${styles.cell} card ${opens ? styles.opens : ''}`}
              data-widget={item.widget}
              style={place(item)}
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

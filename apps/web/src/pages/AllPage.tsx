// What isn't in the dock, each with a line on how it is, and the diagnostics.
import { notOver } from '../agenda.js';
import { hasBulletin } from '../bulletin.js';
import { tabName, TabIcon } from '../components/Dock.js';
import { Icon } from '../components/Icon.js';
import { isOnline, pcMedia, type BridgeState } from '../connection.js';
import type { LastError } from '../diagnostics.js';
import { homeGame, sessionSeconds } from '../games.js';
import { homeStreak } from '../github.js';
import { formatLatency } from '../internet.js';
import type { PageName, Tab } from '../nav.js';
import { homePrinter } from '../printers.js';
import { PAGE_NAMES, percent, T } from '../text.js';
import { formatClock, formatDuration } from '../time.js';
import type { TimerState } from '../timer.js';
import type { WeatherState } from '../weather.js';
import { formatTemp, weatherText } from '../weatherLook.js';
import styles from './AllPage.module.css';

interface AllProps {
  tabs: readonly Tab[];
  state: BridgeState;
  weather: WeatherState;
  timer: TimerState;
  error: LastError | null;
  /** Epoch seconds. */
  now: number;
  onOpen: (page: PageName) => void;
  onTabs: () => void;
  /** null: no reminder measures anything. */
  onMeasurements: (() => void) | null;
  onInfo: () => void;
}

const COLORS: Readonly<Record<Tab | 'network', string>> = {
  home: 'var(--text)',
  stats: 'var(--cpu)',
  ai: 'var(--text)',
  calendar: 'var(--calendar-color)',
  weather: '#ffc861',
  media: 'var(--vram)',
  printer: 'var(--vram)',
  timer: 'var(--good)',
  games: 'var(--ram)',
  github: 'var(--good)',
  shortcuts: 'var(--accent)',
  network: 'var(--cpu)',
  bulletin: 'var(--accent)',
};

export function AllPage({ tabs, state, weather, timer, error, now, onOpen, onTabs, onMeasurements, onInfo }: AllProps) {
  const online = isOnline(state);
  const waiting = online ? T.all.waiting : T.pcOffline;

  function line(tab: Tab | 'network'): string {
    switch (tab) {
      case 'weather': {
        const w = weather.weather;
        return w ? `${formatTemp(w.temp)}, ${weatherText(w.code)}` : weather.settings === null ? T.weather.noLocation : '';
      }
      case 'timer':
        return timer.status === 'idle' ? T.timer.idle : formatDuration(timer.left);
      case 'printer':
        return state.printers.length ? homePrinter(state.printers).state : T.printer.none;
      case 'games': {
        const { steam } = state;
        const { name, sub } = homeGame(steam, steam ? sessionSeconds(steam, state, now) : 0, online, now);
        return name || sub;
      }
      case 'github':
        return state.github ? homeStreak(state.github) : waiting;
      case 'shortcuts':
        return T.all.tiles(state.tiles.length);
      case 'network':
        return state.net ? formatLatency(state.net.latency) : waiting;
      case 'calendar':
        return T.all.events(notOver(state.events.events, now).length);
      case 'media': {
        const media = pcMedia(state);
        return media.active ? media.title : T.media.nothing;
      }
      case 'stats':
        return online && state.stats ? `${T.stats.cpu} ${percent(Math.round(state.stats.cpu))}` : waiting;
      case 'ai': {
        const limit = state.usage?.fiveHour;
        return limit ? `${T.usage.fiveHourShort} ${percent(Math.round(limit.pct))}` : waiting;
      }
      case 'bulletin': {
        const b = state.bulletin;
        if (b?.state === 'running') return T.morning.writing;
        if (b?.state === 'failed') return T.bulletin.failed;
        return hasBulletin(b) && b.madeAt ? formatClock(Math.floor(b.madeAt / 1000)) : '';
      }
      case 'home':
        return '';
    }
  }

  const entries: (Tab | 'network')[] = state.layout.pages.includes('network') ? [...tabs, 'network'] : [...tabs];
  return (
    <main className={styles.page}>
      {entries.map((tab) => (
        <button key={tab} type="button" className={styles.tile} onClick={() => onOpen(tab)}>
          <span style={{ color: COLORS[tab] }}>
            {tab === 'network' ? <Icon name="public" size={32} /> : <TabIcon tab={tab} usage={state.usage} size={32} />}
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{tab === 'network' ? PAGE_NAMES.network : tabName(tab, state.usage)}</span>
            <span className={styles.line}>{line(tab)}</span>
          </span>
        </button>
      ))}
      {onMeasurements && (
        <button type="button" className={styles.tile} onClick={onMeasurements}>
          <span style={{ color: 'var(--accent)' }}>
            <Icon name="insights" size={32} />
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{T.measurements.title}</span>
            <span className={styles.line}>{(state.reminders?.measured ?? []).map((m) => m.title).join(', ')}</span>
          </span>
        </button>
      )}
      <button type="button" className={styles.tile} onClick={onTabs}>
        <span style={{ color: 'var(--muted)' }}>
          <Icon name="shuffle" size={32} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{T.tabs.open}</span>
          <span className={styles.line}>{T.tabs.openLine}</span>
        </span>
      </button>
      <button type="button" className={styles.tile} onClick={onInfo}>
        <span style={{ color: error ? 'var(--warn)' : 'var(--muted)' }}>
          <Icon name="settings" size={32} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{T.all.diagnostics}</span>
          <span className={styles.line}>{error ? T.all.lookHere : T.all.fine}</span>
        </span>
      </button>
    </main>
  );
}

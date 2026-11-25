// PC stats: four gauges and a one-minute CPU/GPU history (firmware/main/ui_stats.c). The
// Internet view is here too, while the "network" page is on.
import type { Stats } from '@deskhub-mobile/protocol';
import { HistoryChart } from '../components/HistoryChart.js';
import { Ring } from '../components/Ring.js';
import { isOnline, type BridgeState, type Connection } from '../connection.js';
import { formatMemory, formatRate, formatTemperature } from '../format.js';
import type { SpeedTestStore } from '../speedTest.js';
import { statusHint } from '../status.js';
import { PAGE_NAMES, T } from '../text.js';
import { InternetView } from './InternetView.js';
import styles from './StatsPage.module.css';

const share = (used: number, total: number) => (total > 0 ? (100 * used) / total : null);
const memory = (used: number, total: number) => (total > 0 ? formatMemory(used, total) : '');

export type StatsView = 'pc' | 'net';

interface StatsProps {
  state: BridgeState;
  connection: Connection;
  speedTest: SpeedTestStore;
  view: StatsView;
  onView: (view: StatsView) => void;
  /** Epoch seconds. */
  now: number;
}

const VIEWS = [
  ['pc', T.stats.pc],
  ['net', PAGE_NAMES.network],
] as const;

export function StatsPage({ state, connection, speedTest, view, onView, now }: StatsProps) {
  const hasNet = state.layout.pages.includes('network');
  return (
    <main className={styles.page}>
      {hasNet && (
        <div className={styles.switch}>
          {VIEWS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={id === view} onClick={() => onView(id)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {hasNet && view === 'net' ? (
        <InternetView state={state} connection={connection} speedTest={speedTest} now={now} />
      ) : (
        <PcView state={state} />
      )}
    </main>
  );
}

interface GaugeProps {
  name: string;
  color: string;
  /** null: nothing to show. */
  percent: number | null;
  sub: string;
}

const Gauge = ({ name, color, percent, sub }: GaugeProps) => (
  <section className={`${styles.gauge} card`}>
    <Ring percent={percent} color={color} size={96} />
    <h2 className={styles.name}>{name}</h2>
    <p className={styles.sub}>{sub}</p>
  </section>
);

function PcView({ state }: { state: BridgeState }) {
  // Like the board, show no old numbers while the PC is offline.
  const s: Stats | null = isOnline(state) ? state.stats : null;
  const hasGpu = s !== null && s.gpu !== null;
  const message = statusHint(state);

  return (
    <div className={styles.view}>
      <div className={styles.gauges}>
        <Gauge name={T.stats.cpu} color="var(--cpu)" percent={s?.cpu ?? null} sub={formatTemperature(s?.cpuTemp ?? null)} />
        <Gauge
          name={T.stats.gpu}
          color="var(--gpu)"
          percent={s?.gpu ?? null}
          sub={s && !hasGpu ? T.stats.noGpu : formatTemperature(hasGpu ? s.gpuTemp : null)}
        />
        <Gauge
          name={T.stats.ram}
          color="var(--ram)"
          percent={s && share(s.ramUsed, s.ramTotal)}
          sub={s ? memory(s.ramUsed, s.ramTotal) : ''}
        />
        <Gauge
          name={T.stats.vram}
          color="var(--vram)"
          percent={hasGpu ? share(s.vramUsed, s.vramTotal) : null}
          sub={hasGpu ? memory(s.vramUsed, s.vramTotal) : ''}
        />
      </div>

      <section className={`${styles.history} card`}>
        <div className={styles.row}>
          <h2 className={styles.muted}>{T.stats.lastMinute}</h2>
          <span style={{ color: 'var(--cpu)' }}>{T.stats.cpu}</span>
          <span style={{ color: 'var(--gpu)' }}>{T.stats.gpu}</span>
          {s && (
            <p className={styles.network}>
              <span>↓ {formatRate(s.netDown)}</span>
              <span>↑ {formatRate(s.netUp)}</span>
            </p>
          )}
        </div>
        <div className={styles.chart}>
          <HistoryChart history={state.history} />
          {message && <p className={styles.hint}>{message}</p>}
        </div>
        <div className={styles.row}>
          <p className={`${styles.muted} ellipsis`}>{s && [s.cpuName, s.gpuName].filter(Boolean).join(', ')}</p>
          <p className={styles.disk}>{s && T.stats.disk(Math.trunc(s.disk))}</p>
        </div>
      </section>
    </div>
  );
}

// PC stats: four gauges and a one-minute CPU/GPU history (firmware/main/ui_stats.c).
import type { Stats } from '@deskhub-mobile/protocol';
import { Gauge } from '../components/Gauge.js';
import { HistoryChart } from '../components/HistoryChart.js';
import { isOnline, type BridgeState } from '../connection.js';
import { formatMemory, formatRate, formatTemperature } from '../format.js';
import { statusHint } from '../status.js';
import styles from './StatsPage.module.css';

const share = (used: number, total: number) => (total > 0 ? (100 * used) / total : null);
const memory = (used: number, total: number) => (total > 0 ? formatMemory(used, total) : '');

export function StatsPage({ state }: { state: BridgeState }) {
  // Like the board, show no old numbers while the PC is offline.
  const s: Stats | null = isOnline(state) ? state.stats : null;
  const hasGpu = s !== null && s.gpu !== null;
  const message = statusHint(state);

  return (
    <main className={styles.page}>
      <div className={styles.gauges}>
        <Gauge name="CPU" color="var(--cpu)" percent={s?.cpu ?? null} sub={formatTemperature(s?.cpuTemp ?? null)} />
        <Gauge
          name="GPU"
          color="var(--gpu)"
          percent={s?.gpu ?? null}
          sub={s && !hasGpu ? 'No GPU data' : formatTemperature(hasGpu ? s.gpuTemp : null)}
        />
        <Gauge
          name="RAM"
          color="var(--ram)"
          percent={s && share(s.ramUsed, s.ramTotal)}
          sub={s ? memory(s.ramUsed, s.ramTotal) : ''}
        />
        <Gauge
          name="VRAM"
          color="var(--vram)"
          percent={hasGpu ? share(s.vramUsed, s.vramTotal) : null}
          sub={hasGpu ? memory(s.vramUsed, s.vramTotal) : ''}
        />
      </div>

      <section className={styles.history}>
        <div className={styles.row}>
          <h2 className={styles.caption}>LAST MINUTE</h2>
          <span className={styles.cpuKey}>CPU</span>
          <span className={styles.gpuKey}>GPU</span>
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
          <p className={styles.names}>{s && [s.cpuName, s.gpuName].filter(Boolean).join('  /  ')}</p>
          <p className={styles.disk}>{s && `Disk ${Math.trunc(s.disk)}% used`}</p>
        </div>
      </section>
    </main>
  );
}

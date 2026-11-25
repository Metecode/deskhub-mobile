// The Internet view of the stats page (firmware/main/ui_net.c).
import { NET_HISTORY } from '@deskhub-mobile/protocol';
import { useSyncExternalStore } from 'react';
import { Icon } from '../components/Icon.js';
import { isOnline, type BridgeState, type Connection } from '../connection.js';
import {
  chartPeak,
  formatAgo,
  formatBytes,
  formatLatency,
  formatMbps,
  jitterText,
  latencyColor,
  latencyPath,
  statusText,
} from '../internet.js';
import { speedTestButton, type SpeedTestStore } from '../speedTest.js';
import { statusHint } from '../status.js';
import styles from './InternetView.module.css';

interface InternetProps {
  state: BridgeState;
  connection: Connection;
  speedTest: SpeedTestStore;
  /** Epoch seconds. */
  now: number;
}

export function InternetView({ state, connection, speedTest, now }: InternetProps) {
  const requestedAt = useSyncExternalStore(speedTest.subscribe, speedTest.getState);
  const { net, stats } = state;
  const online = isOnline(state);
  const hint = statusHint(state);
  // The request is newer than `now`, which moves once a second.
  const button = net && speedTestButton(net, state.netAt, requestedAt, Math.max(now * 1000, requestedAt), online);

  return (
    <div className={styles.view}>
      <div className={styles.top}>
        <section className={styles.card}>
          <h2 className={styles.caption}>LATENCY</h2>
          <p className={styles.latency} style={{ color: net ? latencyColor(net.latency) : undefined }}>
            {formatLatency(net && net.latency)}
          </p>
          <p className={styles.sub} data-bad={(net && net.loss >= 5) || undefined}>
            {net && jitterText(net)}
          </p>
        </section>
        <section className={styles.card}>
          <h2 className={styles.caption}>STATUS</h2>
          <p className={styles.status} style={{ color: net?.online === false ? 'var(--bad)' : 'var(--good)' }}>
            {net ? (net.online ? 'Online' : 'Offline') : '--'}
          </p>
          <p className={styles.sub}>{net && statusText(net, now)}</p>
        </section>
        <section className={styles.card}>
          <h2 className={styles.caption}>DATA USED</h2>
          <p className={styles.data}>
            <span>Today</span>
            <span>{net && formatBytes(net.todayBytes)}</span>
          </p>
          <p className={styles.data}>
            <span>This month</span>
            <span>{net && formatBytes(net.monthBytes)}</span>
          </p>
        </section>
      </div>

      <section className={`${styles.card} ${styles.chartCard}`}>
        <div className={styles.row}>
          <h2 className={styles.caption}>LATENCY, LAST 2 MINUTES</h2>
          <p className={styles.dim}>{net && `max ${chartPeak(net.history)} ms`}</p>
        </div>
        <div className={styles.chart}>
          <svg
            viewBox={`0 0 ${NET_HISTORY - 1} 100`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Latency over the last 2 minutes"
          >
            {[0, 50, 100].map((y) => (
              <path key={y} className={styles.division} d={`M0 ${y}H${NET_HISTORY - 1}`} />
            ))}
            <path className={styles.line} d={latencyPath(net?.history ?? [])} />
          </svg>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>
      </section>

      <section className={`${styles.card} ${styles.speed}`}>
        <div className={styles.row}>
          <h2 className={styles.caption}>SPEED TEST</h2>
          <p className={styles.dim}>
            {online && stats && `Now ↓ ${formatMbps(stats.netDown)}  ↑ ${formatMbps(stats.netUp)} Mbps`}
          </p>
        </div>
        {net && button && (
          <div className={styles.result}>
            <div className={styles.text}>
              <p className={styles.speeds}>
                <span>
                  <Icon name="arrow_downward" size={32} color="var(--gpu)" />
                  {net.speed ? `${net.speed.down.toFixed(0)} Mbps` : '--'}
                </span>
                <span>
                  <Icon name="arrow_upward" size={32} color="var(--cpu)" />
                  {net.speed ? `${net.speed.up.toFixed(0)} Mbps` : '--'}
                </span>
              </p>
              <p className={styles.sub}>
                {net.speed
                  ? `Ping ${net.speed.ping.toFixed(0)} ms  •  tested ${formatAgo(net.speed.at, now)}`
                  : 'No test yet. A test uses about 35 MB of data.'}
              </p>
            </div>
            <button
              type="button"
              className={styles.run}
              disabled={button.disabled}
              onClick={() => {
                connection.send({ type: 'speedtest' });
                speedTest.requested();
              }}
            >
              {button.label}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

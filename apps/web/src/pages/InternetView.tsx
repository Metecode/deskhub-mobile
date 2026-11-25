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
import { formatNumber, T } from '../text.js';
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
        <section className={`${styles.box} card`}>
          <h2 className={styles.muted}>{T.net.latency}</h2>
          <p className={styles.latency} style={{ color: net ? latencyColor(net.latency) : undefined }}>
            {formatLatency(net && net.latency)}
          </p>
          <p className={styles.sub} data-bad={(net && net.loss >= 5) || undefined}>
            {net && jitterText(net)}
          </p>
        </section>
        <section className={`${styles.box} card`}>
          <h2 className={styles.muted}>{T.net.state}</h2>
          <p className={styles.status} style={{ color: net?.online === false ? 'var(--bad)' : 'var(--good)' }}>
            {net ? (net.online ? T.net.online : T.net.offline) : T.none}
          </p>
          <p className={styles.sub}>{net && statusText(net, now)}</p>
        </section>
        <section className={`${styles.box} card`}>
          <h2 className={styles.muted}>{T.net.data}</h2>
          <p className={styles.data}>
            <span>{T.net.today}</span>
            <span>{net && formatBytes(net.todayBytes)}</span>
          </p>
          <p className={styles.data}>
            <span>{T.net.month}</span>
            <span>{net && formatBytes(net.monthBytes)}</span>
          </p>
        </section>
      </div>

      <section className={`${styles.chartCard} card`}>
        <div className={styles.row}>
          <h2 className={styles.muted}>{T.net.chart}</h2>
          <p className={styles.dim}>{net && T.net.max(Math.round(chartPeak(net.history)))}</p>
        </div>
        <div className={styles.chart}>
          <svg
            viewBox={`0 0 ${NET_HISTORY - 1} 100`}
            preserveAspectRatio="none"
            role="img"
            aria-label={T.net.chart}
          >
            {[0, 50, 100].map((y) => (
              <path key={y} className={styles.division} d={`M0 ${y}H${NET_HISTORY - 1}`} />
            ))}
            <path className={styles.line} d={latencyPath(net?.history ?? [])} />
          </svg>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>
      </section>

      <section className={`${styles.speed} card`}>
        <div className={styles.row}>
          <h2 className={styles.muted}>{T.net.speedTest}</h2>
          <p className={styles.dim}>
            {online && stats && T.net.nowRates(formatMbps(stats.netDown), formatMbps(stats.netUp))}
          </p>
        </div>
        {net && button && (
          <div className={styles.result}>
            <div className={styles.text}>
              <p className={styles.speeds}>
                <span>
                  <Icon name="arrow_downward" size={26} color="var(--gpu)" />
                  {net.speed ? `${formatNumber(net.speed.down)} Mbps` : T.none}
                </span>
                <span>
                  <Icon name="arrow_upward" size={26} color="var(--cpu)" />
                  {net.speed ? `${formatNumber(net.speed.up)} Mbps` : T.none}
                </span>
              </p>
              <p className={styles.sub}>
                {net.speed
                  ? T.net.tested(formatNumber(net.speed.ping), formatAgo(net.speed.at, now))
                  : T.net.noTest}
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

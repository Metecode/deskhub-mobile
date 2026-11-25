// Usage of Claude Code or Codex (firmware/main/ui_claude.c).
import type { Alert } from '@deskhub-mobile/protocol';
import { AlertPanel } from '../components/Alert.js';
import { Bar } from '../components/Bar.js';
import { isOnline, type BridgeState } from '../connection.js';
import { formatPercent } from '../format.js';
import { statusHint } from '../status.js';
import {
  agentColor,
  dayLabels,
  fiveHourView,
  formatTokens,
  levelColor,
  weeklyView,
  type LimitView,
} from '../usage.js';
import styles from './AiPage.module.css';

interface AiProps {
  state: BridgeState;
  alert: Alert | null;
  onAlertAction: (action: 'focus' | 'dismiss') => void;
  /** Epoch seconds. */
  now: number;
}

function LimitCard({ title, view: { pct, big, reset, sub } }: { title: string; view: LimitView }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.caption}>{title}</h2>
      <div className={styles.middle}>
        {pct === null ? (
          <p className={styles.big}>{big}</p>
        ) : (
          <>
            <p className={styles.big} style={{ color: levelColor(pct) }}>
              {formatPercent(pct)}
            </p>
            <Bar value={pct} color={levelColor(pct)} height={8} />
          </>
        )}
      </div>
      <p className={styles.reset}>{reset}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
    </section>
  );
}

export function AiPage({ state, alert, onAlertAction, now }: AiProps) {
  const { usage } = state;
  const color = agentColor(usage);
  const days = usage?.days ?? Array<number>(7).fill(0);
  const peak = Math.max(1, ...days);
  const labels = dayLabels(days.length, now);
  const top = usage?.models[0]?.tokens ?? 0;
  const note = isOnline(state) ? usage && `peak ${formatTokens(peak)} tokens` : statusHint(state);
  const today = [
    ['Tokens', usage && formatTokens(usage.today.tokens)],
    ['Output', usage && formatTokens(usage.today.output)],
    ['Messages', usage && String(usage.today.messages)],
    ['Last hour', usage && formatTokens(usage.lastHour)],
  ];

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <LimitCard title="5-HOUR LIMIT" view={fiveHourView(usage, now)} />
        <LimitCard title="WEEKLY LIMIT" view={weeklyView(usage, now)} />
        <section className={styles.card}>
          <h2 className={styles.caption}>TODAY</h2>
          <dl className={styles.today}>
            {today.map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value ?? '--'}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {alert ? (
        <AlertPanel alert={alert} color={color} onAction={onAlertAction} />
      ) : (
        <section className={`${styles.card} ${styles.history}`}>
          <div className={styles.days}>
            <div className={styles.row}>
              <h2 className={styles.caption}>LAST 7 DAYS</h2>
              <p className={styles.note}>{note}</p>
            </div>
            <div className={styles.bars}>
              {days.map((tokens, i) => (
                <div key={i} className={styles.day}>
                  <div className={styles.slot}>
                    <span className={styles.dayBar} style={{ height: `${(100 * tokens) / peak}%`, background: color }} />
                  </div>
                  <span className={styles.dayName}>{labels[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.models}>
            <h2 className={styles.caption}>MODELS TODAY</h2>
            {/* One or two models sit on the pitch four would use. */}
            <div className={styles.modelList} data-few={(usage?.models.length ?? 0) < 3 || undefined}>
              {usage?.models.map(({ name, tokens }, i) => (
                <div key={i} className={styles.model}>
                  <p className={styles.row}>
                    <span className={styles.modelName}>{name}</span>
                    <span className={styles.modelTokens}>{formatTokens(tokens)}</span>
                  </p>
                  <Bar value={top > 0 ? (100 * tokens) / top : 0} color={color} height={6} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

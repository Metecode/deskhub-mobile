// Usage of Claude Code or Codex (firmware/main/ui_claude.c).
import { Bar } from '../components/Bar.js';
import { Ring } from '../components/Ring.js';
import { isOnline, type BridgeState } from '../connection.js';
import { statusHint } from '../status.js';
import { T } from '../text.js';
import { agentColor, dayLabels, fiveHourView, formatTokens, weeklyView, type LimitView } from '../usage.js';
import styles from './AiPage.module.css';

interface AiProps {
  state: BridgeState;
  /** Epoch seconds. */
  now: number;
}

interface LimitProps {
  title: string;
  view: LimitView;
  color: string;
}

function LimitCard({ title, view: { pct, big, reset, sub }, color }: LimitProps) {
  return (
    <section className={`${styles.limit} card`}>
      {pct !== null && <Ring percent={pct} color={pct >= 80 ? 'var(--bad)' : color} size={118} />}
      <div className={styles.limitText}>
        <h2 className={styles.limitName}>{title}</h2>
        {pct === null && <p className={styles.big}>{big}</p>}
        <p className={styles.sub}>{reset}</p>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
    </section>
  );
}

export function AiPage({ state, now }: AiProps) {
  const { usage } = state;
  const color = agentColor(usage);
  const days = usage?.days ?? Array<number>(7).fill(0);
  const peak = Math.max(1, ...days);
  const labels = dayLabels(days.length, now);
  const top = usage?.models[0]?.tokens ?? 0;
  const note = isOnline(state) ? usage && T.usage.peak(formatTokens(peak)) : statusHint(state);
  const facts = [
    [T.usage.output, usage && formatTokens(usage.today.output)],
    [T.usage.lastHour, usage && formatTokens(usage.lastHour)],
  ];

  return (
    <main className={styles.page}>
      <div className={styles.limits}>
        <LimitCard title={T.usage.fiveHour} view={fiveHourView(usage, now)} color={color} />
        <LimitCard title={T.usage.weekly} view={weeklyView(usage, now)} color={color} />
      </div>

      <section className={`${styles.use} card`}>
        <div className={styles.today}>
          <h2 className={styles.muted}>{T.usage.today}</h2>
          <p className={styles.big}>{usage ? formatTokens(usage.today.tokens) : T.none}</p>
          <p className={styles.sub}>{usage && T.usage.todayTokens(usage.today.messages)}</p>
          <dl className={styles.facts}>
            {facts.map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value ?? T.none}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.days}>
          <div className={styles.row}>
            <h2 className={styles.muted}>{T.usage.lastDays}</h2>
            <p className={`${styles.sub} ellipsis`}>{note}</p>
          </div>
          <div className={styles.bars}>
            {days.map((tokens, i) => (
              <div key={i} className={styles.day} data-today={i === days.length - 1 || undefined}>
                <div className={styles.slot}>
                  <span className={styles.dayBar} style={{ height: `${(100 * tokens) / peak}%`, background: color }} />
                </div>
                <span className={styles.dayName}>{labels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {usage && usage.models.length > 0 && (
          <div className={styles.models}>
            <h2 className={styles.muted}>{T.usage.models}</h2>
            <div className={styles.modelList}>
              {usage.models.map(({ name, tokens }, i) => (
                <div key={i}>
                  <p className={styles.row}>
                    <span className="ellipsis">{name}</span>
                    <span className={styles.number}>{formatTokens(tokens)}</span>
                  </p>
                  <Bar value={top > 0 ? (100 * tokens) / top : 0} color={color} height={5} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

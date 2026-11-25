// GitHub contributions (firmware/main/ui_github.c).
import { useRef } from 'react';
import { ContributionChart, WEEKDAYS_WIDTH } from '../components/ContributionChart.js';
import { isOnline, type BridgeState } from '../connection.js';
import { barColor, bestText, formatCount, longestText, pageChart, summary, weekChange } from '../github.js';
import { useInnerSize } from '../hooks.js';
import { T, WEEKDAY_LETTERS } from '../text.js';
import styles from './GitHubPage.module.css';

export function GitHubPage({ state }: { state: BridgeState }) {
  const { github } = state;
  const year = useRef<HTMLDivElement>(null);
  const { width } = useInnerSize(year);
  const why = isOnline(state) ? T.waitingForPc : T.pcOffline;
  const color = barColor(github);
  const change = github && weekChange(github);
  const busiest = Math.max(1, ...(github?.weekDays ?? []), ...(github?.lastWeekDays ?? []));
  const height = (n: number) => `max(calc(2 * var(--u)), ${(100 * n) / busiest}%)`;
  const most = Math.max(1, github?.repos[0]?.commits ?? 0);

  return (
    <main className={styles.page}>
      <section className={`${styles.yearCard} card`}>
        <div className={styles.row}>
          <h2 className={styles.muted}>{T.github.year}</h2>
          <p className={styles.summary}>{github ? summary(github) : why}</p>
        </div>
        <div ref={year} className={styles.year}>
          {width > 0 && (
            <ContributionChart github={github} {...pageChart(github, width - WEEKDAYS_WIDTH - 2)} months weekdays />
          )}
        </div>
      </section>

      <div className={styles.cards}>
        <section className={`${styles.box} card`}>
          <h2 className={styles.muted}>{T.github.streak}</h2>
          <p className={styles.streak}>
            {github ? github.streak : T.none} <span>{T.github.dayUnit}</span>
          </p>
          <dl className={styles.facts}>
            <div>
              <dt>{T.github.longest}</dt>
              <dd>{github ? longestText(github) : T.none}</dd>
            </div>
            <div>
              <dt>{T.github.best}</dt>
              <dd>{github ? bestText(github) : T.none}</dd>
            </div>
          </dl>
        </section>

        <section className={`${styles.box} card`}>
          <h2 className={styles.muted}>{T.github.week}</h2>
          <p className={styles.weekCount}>
            {github ? formatCount(github.week) : T.none} <span data-more={change?.more || undefined}>{change?.text}</span>
          </p>
          <div className={styles.bars}>
            {WEEKDAY_LETTERS.map((letter, i) => {
              const now = github?.weekDays[i];
              const today = github !== null && i === github.weekDays.length - 1;
              return (
                <div key={i} className={styles.day}>
                  <div className={styles.pair}>
                    <span style={{ height: height(github?.lastWeekDays[i] ?? 0), background: 'var(--pressed)' }} />
                    {/* Still to come: nothing. */}
                    <span
                      style={
                        now === undefined
                          ? undefined
                          : { height: height(now), background: now > 0 ? color : 'var(--card-hi)' }
                      }
                    />
                  </div>
                  <span className={styles.letter} data-today={today || undefined}>
                    {letter}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${styles.box} card`}>
          <h2 className={styles.muted}>{T.github.repos}</h2>
          {!github?.repos.length && <p className={styles.none}>{github ? T.github.noCommits : why}</p>}
          <div className={styles.repos}>
            {github?.repos.map(({ name, commits }, i) => (
              <div key={i}>
                <p className={styles.repo}>
                  <span>{name}</span>
                  <span>{formatCount(commits)}</span>
                </p>
                <span
                  className={styles.repoBar}
                  style={{ width: `max(calc(4 * var(--u)), ${(100 * commits) / most}%)`, background: color }}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

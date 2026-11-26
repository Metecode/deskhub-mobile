// The bridge's numbers for the portfolio (docs/plan-phase6.md): never Codex's.
import type { Holding, Portfolio } from '@deskhub-mobile/protocol';
import { formatNumber, percent, T } from '../text.js';
import styles from './PortfolioTable.module.css';

const signed = (n: number, digits = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(n), digits)}`;
/** "+%13,38": in Turkish the sign comes before the per cent sign. */
const signedPct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${percent(formatNumber(Math.abs(n), 2))}`;
const usd = (n: number | null) => (n === null ? T.none : `${formatNumber(n, 2)} $`);
const kindOf = (n: number | null) => (n === null || n === 0 ? undefined : n > 0 ? 'up' : 'down');

function isoDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

function Row({ h }: { h: Holding }) {
  return (
    <tr data-reward={h.kind === 'reward' || undefined}>
      <th scope="row">
        {h.ticker}
        {h.newPosition && <span className={styles.badge}>{T.bulletin.newPosition}</span>}
        {h.kind === 'reward' && <span className={styles.muted}>{T.bulletin.reward}</span>}
      </th>
      <td>{formatNumber(h.quantity, 4)}</td>
      <td>{usd(h.costUsd)}</td>
      <td title={h.price ? `${h.price.kind} · ${h.price.source}` : T.bulletin.noPrice}>
        {h.valueUsd === null ? <span className={styles.muted}>{T.bulletin.noPrice}</span> : usd(h.valueUsd)}
      </td>
      <td data-kind={kindOf(h.pnlUsd)}>
        {h.pnlUsd === null ? T.none : `${signed(h.pnlUsd)} $ (${signedPct(h.pnlPct ?? 0)})`}
      </td>
      <td data-kind={kindOf(h.dayUsd)}>{h.dayUsd === null ? T.none : `${signed(h.dayUsd)} $`}</td>
    </tr>
  );
}

export function PortfolioTable({ portfolio, heading }: { portfolio: Portfolio; heading?: { id: string; title: string } }) {
  const { holdings, gold, totals, mix, quantitiesAsOf } = portfolio;
  const c = T.bulletin.columns;
  return (
    <section className={styles.portfolio}>
      <h2 className={styles.title} id={heading?.id}>
        {heading?.title ?? T.bulletin.portfolio}
      </h2>
      <p className={styles.note}>
        {T.bulletin.portfolioNote}
        {quantitiesAsOf && ` ${T.bulletin.asOf(isoDay(quantitiesAsOf))}.`}
      </p>
      <div className={styles.frame} data-no-swipe>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{c.ticker}</th>
              <th>{c.quantity}</th>
              <th>{c.cost}</th>
              <th>{c.value}</th>
              <th>{c.pnl}</th>
              <th>{c.day}</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <Row key={h.ticker} h={h} />
            ))}
            {gold && (
              <tr>
                <th scope="row">{T.bulletin.gold(formatNumber(gold.grams, 2))}</th>
                <td />
                <td>{`${formatNumber(gold.costTry, 0)} ₺`}</td>
                <td>{gold.valueTry === null ? <span className={styles.muted}>{T.bulletin.noPrice}</span> : `${formatNumber(gold.valueTry, 0)} ₺`}</td>
                <td data-kind={kindOf(gold.pnlTry)}>
                  {gold.pnlTry === null ? T.none : `${signed(gold.pnlTry, 0)} ₺ (${signedPct(gold.pnlPct ?? 0)})`}
                </td>
                <td />
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{T.bulletin.total}</th>
              <td />
              <td>{usd(totals.costUsd)}</td>
              <td>{usd(totals.valueUsd)}</td>
              <td data-kind={kindOf(totals.pnlUsd)}>
                {totals.pnlUsd === null ? T.none : `${signed(totals.pnlUsd)} $ (${signedPct(totals.pnlPct ?? 0)})`}
              </td>
              <td data-kind={kindOf(totals.dayUsd)}>{totals.dayUsd === null ? T.none : `${signed(totals.dayUsd)} $`}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {holdings.some((h) => h.kind === 'reward') && <p className={styles.note}>{T.bulletin.rewardsLeftOut}</p>}
      {mix && (
        <div className={styles.mix} aria-label={T.bulletin.mix}>
          {(['etf', 'stock', 'gold'] as const).map((part) => (
            <div key={part} className={styles.mixPart}>
              <span className={styles.mixName}>{T.bulletin.mixParts[part]}</span>
              <div className={styles.mixTrack}>
                <div className={styles.mixFill} style={{ width: `${Math.min(100, mix[part].pct)}%` }} />
                <div className={styles.mixTarget} style={{ left: `${mix[part].target}%` }} />
              </div>
              <span className={styles.mixText}>
                {T.bulletin.mixOf(percent(formatNumber(mix[part].pct, 1)), percent(mix[part].target))}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

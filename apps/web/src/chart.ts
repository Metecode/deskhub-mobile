import { HISTORY_MS, type HistoryPoint } from './connection.js';

/** Points further apart than this aren't joined: something was missing in between. */
const GAP_MS = 2500;

/**
 * An SVG path through a series, in a box `HISTORY_MS` wide (the newest point of the
 * whole history at the right edge) and 100 tall. Missing values and gaps in time
 * interrupt the line.
 */
export function linePath(history: readonly HistoryPoint[], value: (p: HistoryPoint) => number | null): string {
  const end = history.at(-1)?.t ?? 0;
  let path = '';
  let previous: number | null = null;
  for (const point of history) {
    const v = value(point);
    if (v === null) {
      previous = null;
      continue;
    }
    const joined = previous !== null && point.t - previous <= GAP_MS;
    const x = HISTORY_MS - (end - point.t);
    const y = 100 - Math.min(100, Math.max(0, v));
    path += `${joined ? 'L' : 'M'}${x} ${Number(y.toFixed(2))}`;
    previous = point.t;
  }
  return path;
}

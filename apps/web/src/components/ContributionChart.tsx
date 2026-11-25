// GitHub's squares: a column per week, Sunday on top, the newest week on the right
// (chart_draw_cb in firmware/main/ui_github.c).
import type { GitHub } from '@deskhub-mobile/protocol';
import { memo } from 'react';
import { GAP, levelColor, monthLabels, squares, type ChartSize } from '../github.js';
import styles from './ContributionChart.module.css';

interface ContributionChartProps extends ChartSize {
  github: GitHub | null;
  months?: boolean;
  /** Mon, Wed and Fri on the left. */
  weekdays?: boolean;
}

const MONTHS_HEIGHT = 20;
export const WEEKDAYS_WIDTH = 34;

export const ContributionChart = memo(function ContributionChart({
  github,
  pitch,
  weeks,
  months = false,
  weekdays = false,
}: ContributionChartProps) {
  const left = weekdays ? WEEKDAYS_WIDTH : 0;
  const top = months ? MONTHS_HEIGHT : 0;
  const size = pitch - GAP;
  const radius = size >= 10 ? 2 : 1;
  // One more all around for today's outline.
  const width = left + weeks * pitch - GAP + 2;
  const height = top + 7 * pitch - GAP + 2;
  const days = squares(github, weeks);
  const today = days.find((day) => day.today);
  return (
    <svg
      className={styles.chart}
      viewBox={`${-left - 1} ${-top - 1} ${width} ${height}`}
      style={{ width: `calc(${width} * var(--u))`, height: `calc(${height} * var(--u))` }}
      role="img"
      aria-label="Contributions by day"
    >
      {months &&
        monthLabels(github, weeks, pitch).map(({ x, name }) => (
          <text key={x} x={x} y={-7}>
            {name}
          </text>
        ))}
      {weekdays &&
        ['Mon', 'Wed', 'Fri'].map((name, i) => (
          <text key={name} x={-left} y={(1 + 2 * i) * pitch + size / 2 + 5}>
            {name}
          </text>
        ))}
      {days.map(({ column, row, level }) => (
        <rect
          key={column * 7 + row}
          x={column * pitch}
          y={row * pitch}
          width={size}
          height={size}
          rx={radius}
          fill={levelColor(level, github?.accent ?? false)}
        />
      ))}
      {today && (
        // In the gap around the square, so that its colour still shows.
        <rect
          className={styles.today}
          x={today.column * pitch - 0.5}
          y={today.row * pitch - 0.5}
          width={size + 1}
          height={size + 1}
          rx={radius + 0.5}
        />
      )}
    </svg>
  );
});

// Number formats of the board's stats page (firmware/main/ui_stats.c), in Turkish.
import { formatNumber, percent } from './text.js';

/** A network rate in KB/s. */
export function formatRate(kbps: number): string {
  return kbps >= 1024 ? `${formatNumber(kbps / 1024, 1)} MB/s` : `${Math.trunc(kbps)} KB/s`;
}

export function formatPercent(pct: number): string {
  return percent(Math.trunc(pct + 0.5));
}

/** "" when unknown. */
export function formatTemperature(celsius: number | null): string {
  return celsius === null ? '' : `${Math.trunc(celsius)}°C`;
}

export function formatMemory(used: number, total: number): string {
  return `${formatNumber(used, 1)} / ${formatNumber(total)} GB`;
}

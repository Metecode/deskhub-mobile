// Number formats of the board's stats page (firmware/main/ui_stats.c).

/** A network rate in KB/s. */
export function formatRate(kbps: number): string {
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${Math.trunc(kbps)} KB/s`;
}

export function formatPercent(pct: number): string {
  return `${Math.trunc(pct + 0.5)}%`;
}

/** "" when unknown. */
export function formatTemperature(celsius: number | null): string {
  return celsius === null ? '' : `${Math.trunc(celsius)}°C`;
}

export function formatMemory(used: number, total: number): string {
  return `${used.toFixed(1)} / ${total.toFixed(0)} GB`;
}

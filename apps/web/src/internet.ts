// What the Internet view and the Home card say (firmware/main/ui_net.c, home_refresh_net
// in ui_home.c). `now` is in epoch seconds.
import { NET_HISTORY, type Net } from '@deskhub-mobile/protocol';
import { formatNumber, T } from './text.js';

export function formatBytes(b: number): string {
  if (b >= 1e12) return `${formatNumber(b / 1e12, 2)} TB`;
  if (b >= 1e9) return `${formatNumber(b / 1e9, 1)} GB`;
  if (b >= 1e6) return `${formatNumber(b / 1e6)} MB`;
  return `${formatNumber(b / 1e3)} KB`;
}

/** "5 dk önce" */
export function formatAgo(t: number, now: number): string {
  const d = Math.trunc(now - t);
  if (t <= 0) return T.net.never;
  if (d < 60) return T.net.justNow;
  if (d < 3600) return T.net.minutesAgo(Math.trunc(d / 60));
  if (d < 86_400) return T.net.hoursAgo(Math.trunc(d / 3600));
  return T.net.daysAgo(Math.trunc(d / 86_400));
}

/** "3 gün 5 sa", "1 sa 2 dk", "45 sn" */
export function formatSpan(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds));
  if (s >= 86_400) return T.daysHours(Math.trunc(s / 86_400), Math.trunc(s / 3600) % 24);
  if (s >= 3600) return T.hoursMinutes(Math.trunc(s / 3600), Math.trunc(s / 60) % 60);
  if (s >= 60) return T.minutes(Math.trunc(s / 60));
  return T.seconds(s);
}

export const formatLatency = (ms: number | null) => (ms === null ? T.none : `${Math.trunc(ms + 0.5)} ms`);

export function latencyColor(ms: number | null): string {
  if (ms === null) return 'var(--dim)';
  return ms < 40 ? 'var(--text)' : ms < 100 ? 'var(--warn)' : 'var(--bad)';
}

export const jitterText = ({ jitter, loss }: Net) => T.net.quality(formatNumber(jitter, 1), loss);

/** Uptime, then the last outage (or the IP address). */
export function statusText(net: Net, now: number): string {
  const up = net.online && net.upSince > 0 ? T.net.up(formatSpan(now - net.upSince)) : '';
  const drop = net.lastDrop
    ? T.net.lastDrop(formatAgo(net.lastDrop.at, now), formatSpan(net.lastDrop.seconds))
    : net.ip || T.net.noDrops;
  return up ? `${up}, ${drop}` : drop;
}

export function homeText(net: Net, now: number): string {
  if (net.testing) return T.net.testing;
  if (!net.speed) return jitterText(net);
  const { down, up, at } = net.speed;
  return `↓ ${formatNumber(down)}  ↑ ${formatNumber(up)} Mbps, ${formatAgo(at, now)}`;
}

/** A rate in KB/s (1024 bytes) as Mbps. */
export const formatMbps = (kbps: number) => formatNumber((kbps * 8.192) / 1000, 1);

/** The top of the latency chart, ms. */
export const chartPeak = (history: Net['history']) => Math.max(50, ...history.map((ms) => ms ?? 0));

/** An SVG path through the probes in a box NET_HISTORY - 1 wide and 100 tall. Lost ones are gaps. */
export function latencyPath(history: Net['history']): string {
  const peak = chartPeak(history);
  let path = '';
  let joined = false;
  history.forEach((ms, i) => {
    if (ms !== null) {
      const x = NET_HISTORY - history.length + i;
      path += `${joined ? 'L' : 'M'}${x} ${Number((100 - (100 * ms) / peak).toFixed(2))}`;
    }
    joined = ms !== null;
  });
  return path;
}

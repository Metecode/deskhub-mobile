// What the Internet view and the Home card say (firmware/main/ui_net.c, home_refresh_net
// in ui_home.c). `now` is in epoch seconds.
import { NET_HISTORY, type Net } from '@deskhub-mobile/protocol';

export function formatBytes(b: number): string {
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}

/** "5m ago" */
export function formatAgo(t: number, now: number): string {
  const d = Math.trunc(now - t);
  if (t <= 0) return 'never';
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.trunc(d / 60)}m ago`;
  if (d < 86_400) return `${Math.trunc(d / 3600)}h ago`;
  return `${Math.trunc(d / 86_400)}d ago`;
}

/** "3d 5h", "1h 02m", "45s" */
export function formatSpan(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds));
  if (s >= 86_400) return `${Math.trunc(s / 86_400)}d ${Math.trunc(s / 3600) % 24}h`;
  if (s >= 3600) return `${Math.trunc(s / 3600)}h ${String(Math.trunc(s / 60) % 60).padStart(2, '0')}m`;
  if (s >= 60) return `${Math.trunc(s / 60)}m`;
  return `${s}s`;
}

export const formatLatency = (ms: number | null) => (ms === null ? '--' : `${Math.trunc(ms + 0.5)} ms`);

export function latencyColor(ms: number | null): string {
  if (ms === null) return 'var(--dim)';
  return ms < 40 ? 'var(--text)' : ms < 100 ? 'var(--warn)' : 'var(--bad)';
}

export const jitterText = ({ jitter, loss }: Net) => `Jitter ${jitter.toFixed(1)} ms  •  Loss ${loss}%`;

/** Uptime, then the last outage (or the IP address). */
export function statusText(net: Net, now: number): string {
  const up = net.online && net.upSince > 0 ? `Up ${formatSpan(now - net.upSince)}` : '';
  const drop = net.lastDrop
    ? `Last drop ${formatAgo(net.lastDrop.at, now)}, ${formatSpan(net.lastDrop.seconds)}`
    : net.ip || 'No drops seen';
  return up ? `${up}  •  ${drop}` : drop;
}

export function homeText(net: Net, now: number): string {
  if (net.testing) return 'Speed test running...';
  if (!net.speed) return jitterText(net);
  const { down, up, at } = net.speed;
  return `↓ ${down.toFixed(0)}  ↑ ${up.toFixed(0)} Mbps  •  ${formatAgo(at, now)}`;
}

/** A rate in KB/s (1024 bytes) as Mbps. */
export const formatMbps = (kbps: number) => ((kbps * 8.192) / 1000).toFixed(1);

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

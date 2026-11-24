// Kept apart from the schemas so that the web app doesn't have to carry Zod.
import type { RawMessage } from './companion.js';

/** Stats with the board's fallbacks applied. */
export interface Stats {
  cpu: number;
  cpuTemp: number | null;
  ramUsed: number;
  ramTotal: number;
  /** null: no GPU data. */
  gpu: number | null;
  gpuTemp: number | null;
  vramUsed: number;
  vramTotal: number;
  netDown: number;
  netUp: number;
  disk: number;
  cpuName: string;
  gpuName: string;
}

/**
 * Reads a stats message the way the board does (hub_server.c, on_stats): a missing
 * or mistyped field gets a default, a GPU exists when "gpu" is a number, and a
 * temperature below zero is unknown. Works on any raw message.
 */
export function normalizeStats(raw: RawMessage): Stats {
  const number = (key: string, fallback = 0) => {
    const v = raw[key];
    return typeof v === 'number' ? v : fallback;
  };
  const text = (key: string) => {
    const v = raw[key];
    return typeof v === 'string' ? v : '';
  };
  const temperature = (key: string) => {
    const v = number(key, -1);
    return v >= 0 ? v : null;
  };
  return {
    cpu: number('cpu'),
    cpuTemp: temperature('cpu_temp'),
    ramUsed: number('ram_used'),
    ramTotal: number('ram_total'),
    gpu: typeof raw.gpu === 'number' ? raw.gpu : null,
    gpuTemp: temperature('gpu_temp'),
    vramUsed: number('vram_used'),
    vramTotal: number('vram_total'),
    netDown: number('net_down'),
    netUp: number('net_up'),
    disk: number('disk'),
    cpuName: text('cpu_name'),
    gpuName: text('gpu_name'),
  };
}

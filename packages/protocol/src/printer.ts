// 3D printers of any brand. Source: on_printer in firmware/main/hub_server.c.
import type { RawMessage } from './companion.js';
import { bool, color, fields, int, list, text, type Fields } from './fields.js';
import { MAX_FILAMENTS, MAX_PRINTERS } from './limits.js';

export interface Filament {
  /** "#rrggbb" */
  color: string;
  type: string;
  active: boolean;
}

export interface Printer {
  online: boolean;
  name: string;
  model: string;
  /** IDLE, PREPARE, SLICING, RUNNING, PAUSE, FINISH, FAILED, OFFLINE, or something else. */
  state: string;
  file: string;
  speed: string;
  error: string;
  /** % */
  pct: number;
  /** Minutes. */
  remaining: number;
  layer: number;
  layers: number;
  /** °C, null when unknown. */
  nozzle: number | null;
  nozzleTarget: number | null;
  bed: number | null;
  bedTarget: number | null;
  chamber: number | null;
  filaments: readonly Filament[];
}

function temperature(o: Fields, key: string): number | null {
  const v = o[key];
  return typeof v === 'number' ? v : null;
}

export function normalizePrinters(raw: RawMessage): Printer[] {
  return list(raw, 'printers')
    .slice(0, MAX_PRINTERS)
    .map((item) => {
      const p = fields(item);
      return {
        online: bool(p, 'online'),
        name: text(p, 'name'),
        model: text(p, 'model'),
        state: text(p, 'state'),
        file: text(p, 'file'),
        speed: text(p, 'speed'),
        error: text(p, 'error'),
        pct: int(p, 'pct'),
        remaining: int(p, 'remaining_min'),
        layer: int(p, 'layer'),
        layers: int(p, 'layers'),
        nozzle: temperature(p, 'nozzle'),
        nozzleTarget: temperature(p, 'nozzle_target'),
        bed: temperature(p, 'bed'),
        bedTarget: temperature(p, 'bed_target'),
        chamber: temperature(p, 'chamber'),
        filaments: list(p, 'ams')
          .slice(0, MAX_FILAMENTS)
          .map((slot) => {
            const f = fields(slot);
            return { color: color(f, 'color', '#444444'), type: text(f, 'type'), active: bool(f, 'active') };
          }),
      };
    });
}

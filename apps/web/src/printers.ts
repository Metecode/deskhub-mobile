// What the printer page and the Home card say (firmware/main/ui_printer.c,
// home_refresh_printer in ui_home.c).
import type { Printer } from '@deskhub-mobile/protocol';
import { formatClock, formatWeekday } from './time.js';

const STATES: Readonly<Record<string, string>> = {
  RUNNING: 'Printing',
  PREPARE: 'Preparing',
  SLICING: 'Slicing',
  PAUSE: 'Paused',
  FINISH: 'Finished',
  FAILED: 'Failed',
  IDLE: 'Idle',
  OFFLINE: 'Offline',
};

export const stateText = (state: string): string =>
  Object.hasOwn(STATES, state) ? STATES[state]! : state || 'Unknown';

export function stateColor(state: string): string {
  switch (state) {
    case 'RUNNING':
    case 'PREPARE':
    case 'SLICING':
      return 'var(--accent)';
    case 'PAUSE':
      return 'var(--warn)';
    case 'FINISH':
      return 'var(--good)';
    case 'FAILED':
      return 'var(--bad)';
    default:
      return 'var(--dim)';
  }
}

export const isActive = ({ state }: Printer) => state === 'RUNNING' || state === 'PAUSE' || state === 'PREPARE';

/** Which printer shows: the picked one, else the first that is at work, else the first. */
export function shownPrinter(printers: readonly Printer[], picked: number | null): number {
  if (picked !== null && picked < printers.length) return picked;
  return Math.max(0, printers.findIndex(isActive));
}

export const formatTemp = (celsius: number | null) =>
  celsius === null ? '--' : `${Math.sign(celsius) * Math.round(Math.abs(celsius)) || 0}°`;

export function formatRemaining(minutes: number): string {
  return minutes >= 60
    ? `${Math.trunc(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m left`
    : `${minutes}m left`;
}

/** "Done at 9:49 AM", with the day when it is far off. `at`: when the message arrived, ms. */
export function formatDone(minutes: number, at: number, hour12?: boolean): string {
  const done = Math.trunc(at / 1000) + minutes * 60;
  const clock = formatClock(done, hour12);
  return minutes >= 18 * 60 ? `Done ${formatWeekday(done)} ${clock}` : `Done at ${clock}`;
}

export interface PrinterView {
  /** null: the state instead of a percentage. */
  pct: number | null;
  remaining: string;
  done: string;
  layer: string;
  fileCaption: string;
  file: string;
  speed: string;
}

export function printerView(printer: Printer, at: number): PrinterView {
  const active = isActive(printer);
  const finished = printer.state === 'FINISH';
  const counting = active && printer.remaining > 0;
  return {
    pct: finished ? 100 : active ? printer.pct : null,
    remaining: counting ? formatRemaining(printer.remaining) : '',
    done: counting ? formatDone(printer.remaining, at) : finished ? 'Ready to remove' : '',
    layer: printer.layers > 0 && (active || finished) ? `Layer ${printer.layer} of ${printer.layers}` : '',
    fileCaption: active ? 'PRINTING' : finished ? 'LAST PRINT' : 'LAST FILE',
    file: printer.file || '--',
    speed: printer.speed && active ? `${printer.speed} speed` : '',
  };
}

export const printerName = ({ name, model }: Printer) => name || model;

/** The Home card: the printer at work, else the first. Slicing counts as idle here. */
export function homePrinter(printers: readonly Printer[]) {
  const printer = printers[shownPrinter(printers, null)];
  if (!printer) return { state: '', color: 'var(--dim)', file: 'No printer connected', pct: 0, info: '' };
  const active = isActive(printer);
  const finished = printer.state === 'FINISH';
  const pct = finished ? 100 : active ? printer.pct : 0;
  const known = active || finished || printer.state === 'FAILED' || printer.state === 'OFFLINE';
  return {
    state: `${printerName(printer)}  •  ${known ? stateText(printer.state) : 'Idle'}`,
    color: known ? stateColor(printer.state) : 'var(--dim)',
    file: printer.file || (active ? 'Printing' : 'Not printing'),
    pct,
    info:
      active && printer.remaining > 0
        ? `${pct}%  •  ${formatRemaining(printer.remaining)}`
        : finished
          ? 'Done  •  ready to remove'
          : '',
  };
}

/** A slot this dark gets an edge. */
export const isDarkFilament = (color: string) => Number.parseInt(color.slice(1), 16) < 0x202020;

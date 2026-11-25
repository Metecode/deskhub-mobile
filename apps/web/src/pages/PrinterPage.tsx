// 3D printers (firmware/main/ui_printer.c).
import type { Printer } from '@deskhub-mobile/protocol';
import { useState, type CSSProperties } from 'react';
import { Empty } from '../components/Empty.js';
import { Icon } from '../components/Icon.js';
import { isOnline, type BridgeState } from '../connection.js';
import type { IconName } from '../icons.js';
import { formatTemp, isDarkFilament, printerName, printerView, shownPrinter, stateColor, stateText } from '../printers.js';
import styles from './PrinterPage.module.css';

// 220 px, 16 px thick, 270 degrees from 135.
const ARC = 'M37.88 182.12 A102 102 0 1 1 182.12 182.12';

const TEMPERATURES = (p: Printer): [IconName, string, string, number | null, number | null][] => [
  ['local_fire_department', 'var(--warn)', 'Nozzle', p.nozzle, p.nozzleTarget],
  ['layers', 'var(--cpu)', 'Bed', p.bed, p.bedTarget],
  ['device_thermostat', 'var(--gpu)', 'Chamber', p.chamber, null],
];

export function PrinterPage({ state }: { state: BridgeState }) {
  const [picked, setPicked] = useState<number | null>(null);
  const { printers } = state;
  const index = shownPrinter(printers, picked);
  const printer = printers[index];
  if (!printer) {
    const hint = isOnline(state) ? 'Add one with deskhub-printers on your PC' : 'Start the companion app on your PC';
    return (
      <main className={styles.page}>
        <Empty icon="view_in_ar" title="No printer connected" hint={hint} />
      </main>
    );
  }

  const view = printerView(printer, state.printersAt);
  const color = stateColor(printer.state);
  const value = Math.min(100, Math.max(0, view.pct ?? 0));
  const many = printers.length > 1;
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <button
          type="button"
          className={styles.name}
          disabled={!many}
          onClick={() => setPicked((index + 1) % printers.length)}
        >
          {printerName(printer)}
        </button>
        <span className={styles.chip} style={{ '--state': color } as CSSProperties}>
          {stateText(printer.state)}
        </span>
        <span className={styles.count}>{many ? `${index + 1} of ${printers.length}  ›` : printer.model}</span>
      </header>

      <div className={styles.body}>
        <section className={`${styles.card} ${styles.progress}`}>
          <div className={styles.dial}>
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <path className={styles.track} d={ARC} />
              {value > 0 && (
                <path className={styles.arc} d={ARC} stroke={color} pathLength={100} strokeDasharray={`${value} 200`} />
              )}
            </svg>
            <p className={styles.pct} data-text={view.pct === null || undefined}>
              {view.pct === null ? stateText(printer.state) : `${view.pct}%`}
            </p>
            <p className={styles.remaining}>{view.remaining}</p>
          </div>
          <p className={styles.done}>{view.done}</p>
          <p className={styles.layer}>{view.layer}</p>
          <p className={styles.error}>{printer.error}</p>
        </section>

        <section className={`${styles.card} ${styles.job}`}>
          <h2 className={styles.caption}>{view.fileCaption}</h2>
          <p className={styles.file}>{view.file}</p>
          <p className={styles.small}>{view.speed}</p>
        </section>

        <section className={`${styles.card} ${styles.temperatures}`}>
          {TEMPERATURES(printer).map(([icon, tint, name, value, target]) => (
            <div key={name}>
              <p className={styles.tempName}>
                <Icon name={icon} size={24} color={tint} />
                {name}
              </p>
              <p className={styles.temp}>{formatTemp(value)}</p>
              <p className={styles.small}>{target !== null && target > 0 && `target ${formatTemp(target)}`}</p>
            </div>
          ))}
        </section>

        <section className={`${styles.card} ${styles.filament}`}>
          <h2 className={styles.caption}>FILAMENT</h2>
          {printer.filaments.length === 0 && <p className={styles.none}>No AMS data</p>}
          <div className={styles.slots}>
            {printer.filaments.map(({ color: filament, type, active }, i) => (
              <div key={i} className={styles.slot} data-active={active || undefined}>
                <span
                  className={styles.swatch}
                  data-dark={isDarkFilament(filament) || undefined}
                  style={{ background: filament }}
                />
                <span className={styles.slotType}>{type}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

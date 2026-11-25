// 3D printers (firmware/main/ui_printer.c).
import type { Printer } from '@deskhub-mobile/protocol';
import { useState, type CSSProperties } from 'react';
import { Empty } from '../components/Empty.js';
import { Icon } from '../components/Icon.js';
import { Ring } from '../components/Ring.js';
import { isOnline, type BridgeState } from '../connection.js';
import type { IconName } from '../icons.js';
import { formatTemp, isDarkFilament, printerName, printerView, shownPrinter, stateColor, stateText } from '../printers.js';
import { printerError, T } from '../text.js';
import styles from './PrinterPage.module.css';

const TEMPERATURES = (p: Printer): [IconName, string, string, number | null, number | null][] => [
  ['local_fire_department', 'var(--warn)', T.printer.nozzle, p.nozzle, p.nozzleTarget],
  ['layers', 'var(--cpu)', T.printer.bed, p.bed, p.bedTarget],
  ['device_thermostat', 'var(--gpu)', T.printer.chamber, p.chamber, null],
];

export function PrinterPage({ state }: { state: BridgeState }) {
  const [picked, setPicked] = useState<number | null>(null);
  const { printers } = state;
  const index = shownPrinter(printers, picked);
  const printer = printers[index];
  if (!printer) {
    const hint = isOnline(state) ? T.printer.add : T.status.startCompanion;
    return (
      <main className={styles.page}>
        <Empty icon="view_in_ar" title={T.printer.none} hint={hint} />
      </main>
    );
  }

  const view = printerView(printer, state.printersAt);
  const color = stateColor(printer.state);
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
        <span className={styles.count}>{many ? `${T.printer.of(index + 1, printers.length)}  ›` : printer.model}</span>
      </header>

      <div className={styles.body}>
        <section className={`${styles.progress} card`}>
          {view.pct === null ? (
            <p className={styles.state} style={{ color }}>
              {stateText(printer.state)}
            </p>
          ) : (
            <Ring percent={view.pct} color={color} size={136} />
          )}
          <p className={styles.remaining}>{view.remaining}</p>
          <p className={styles.done}>{view.done}</p>
          <p className={styles.layer}>{view.layer}</p>
          <p className={styles.error}>{printerError(printer.error)}</p>
        </section>

        <section className={`${styles.job} card`}>
          <h2 className={styles.muted}>{view.fileCaption}</h2>
          <p className={styles.file}>{view.file}</p>
          <p className={styles.small}>{view.speed}</p>
        </section>

        <section className={`${styles.temperatures} card`}>
          {TEMPERATURES(printer).map(([icon, tint, name, value, target]) => (
            <div key={name}>
              <p className={styles.tempName}>
                <Icon name={icon} size={20} color={tint} />
                {name}
              </p>
              <p className={styles.temp}>{formatTemp(value)}</p>
              <p className={styles.small}>{target !== null && target > 0 && T.printer.target(formatTemp(target))}</p>
            </div>
          ))}
        </section>

        <section className={`${styles.filament} card`}>
          <h2 className={styles.muted}>{T.printer.filament}</h2>
          {printer.filaments.length === 0 && <p className={styles.none}>{T.printer.noAms}</p>}
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

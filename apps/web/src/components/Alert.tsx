// "An agent is waiting for you" (firmware/main/ui_alert.c): a strip in place of the usage
// card on Home, a panel in place of the history card on the AI page.
import type { Alert } from '@deskhub-mobile/protocol';
import { kindText, panelText, shortDetail } from '../alerts.js';
import styles from './Alert.module.css';
import { Icon } from './Icon.js';

interface AlertProps {
  alert: Alert;
  /** The agent's colour. */
  color: string;
  onAction: (action: 'focus' | 'dismiss') => void;
}

export function AlertStrip({ alert, color, onAction }: AlertProps) {
  return (
    <div className={styles.strip}>
      <span className={styles.badge}>
        <Icon name="auto_awesome" size={24} color={color} />
      </span>
      <div className={styles.text}>
        <p className={styles.kind}>{alert.project || kindText(alert)}</p>
        <p className={styles.line}>{shortDetail(alert)}</p>
      </div>
      <button type="button" className={styles.round} aria-label="Not now" onClick={() => onAction('dismiss')}>
        <Icon name="close" size={24} />
      </button>
      <button type="button" className={styles.roundMain} aria-label="Show on PC" onClick={() => onAction('focus')}>
        <Icon name="open_in_new" size={24} />
      </button>
    </div>
  );
}

export function AlertPanel({ alert, color, onAction }: AlertProps) {
  const { title, detail } = panelText(alert);
  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.badge}>
          <Icon name="auto_awesome" size={24} color={color} />
        </span>
        <div className={styles.text}>
          <p className={styles.caption}>{kindText(alert)}</p>
          <p className={styles.project}>{alert.project}</p>
        </div>
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.detail}>{detail}</p>
      <div className={styles.buttons}>
        <button type="button" className={styles.pill} onClick={() => onAction('dismiss')}>
          Not now
        </button>
        <button type="button" className={styles.pillMain} onClick={() => onAction('focus')}>
          Show on PC
        </button>
      </div>
    </section>
  );
}

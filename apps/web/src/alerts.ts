// "An agent is waiting for you" (firmware/main/ui_alert.c).
import type { Alert } from '@deskhub-mobile/protocol';
import { Store } from './store.js';
import { alertText, T } from './text.js';

const same = (a: Alert, b: Alert) => JSON.stringify(a) === JSON.stringify(b);

/** The alert to show, or null. */
export class AlertStore extends Store<Alert | null> {
  readonly #onNew: () => void;
  #received: Alert | null | undefined;
  /** The one that was hidden with a button. */
  #hidden: Alert | null = null;
  /** The last one that counted as new. */
  #lastId: string | null = null;

  /** `onNew` is called for an alert that hasn't been on the screen yet. */
  constructor(onNew: () => void) {
    super(null);
    this.#onNew = onNew;
  }

  /** The latest from the bridge. undefined: it doesn't have any message about alerts. */
  update(alert: Alert | null | undefined): void {
    if (alert === this.#received) return;
    this.#received = alert;
    if (alert === undefined) {
      // The bridge was restarted. The companion will send it again, so nothing is forgotten.
      this.setState(null);
      return;
    }
    if (alert === null) {
      this.#hidden = this.#lastId = null;
      this.setState(null);
      return;
    }
    // "Show on PC" doesn't end a permission alert on the companion, so every reconnect
    // brings it along (the board would show it again).
    if (this.#hidden && same(alert, this.#hidden)) return;
    this.#hidden = null;
    const isNew = alert.id !== this.#lastId;
    this.#lastId = alert.id;
    this.setState(alert);
    if (isNew) this.#onNew();
  }

  /** After one of its buttons. */
  hide(): void {
    this.#hidden = this.getState();
    this.#lastId = null;
    this.setState(null);
  }
}

export const kindText = ({ permission }: Alert) => (permission ? T.alert.permission : T.alert.waiting);

/** The card in the panel. A second line only when it adds something. */
export function panelText(alert: Alert): { title: string; detail: string } {
  const title = alert.title || T.alert.waitingTitle;
  return { title: alertText(title), detail: alert.detail === title ? '' : alertText(alert.detail) };
}

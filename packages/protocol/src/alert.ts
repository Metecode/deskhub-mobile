// "An agent is waiting for you". Source: on_alert in firmware/main/hub_server.c.
import type { RawMessage } from './companion.js';
import { bool, text } from './fields.js';
import { ALERT_ID_MAX } from './limits.js';

export interface Alert {
  /** Fit for an `alert_action` command. */
  id: string;
  /** It wants a permission. Otherwise it waits for a reply. */
  permission: boolean;
  title: string;
  detail: string;
  project: string;
}

/** null: nothing is waiting. */
export function normalizeAlert(raw: RawMessage): Alert | null {
  if (bool(raw, 'clear')) return null;
  return {
    // Echoed back to the companion, so only safe characters are kept.
    id: text(raw, 'id')
      .replace(/[^0-9A-Za-z_-]/g, '_')
      .slice(0, ALERT_ID_MAX),
    permission: text(raw, 'kind') === 'permission',
    title: text(raw, 'title'),
    detail: text(raw, 'detail'),
    project: text(raw, 'project'),
  };
}

import type { BridgeState } from './connection.js';
import { T } from './text.js';

/** What to do about missing data, "" when there is nothing to do. */
export function statusHint({ link, pcOnline }: BridgeState): string {
  if (link === 'bad_origin') return T.status.badOrigin;
  if (link !== 'open') return T.status.connecting;
  return pcOnline ? '' : T.status.startCompanion;
}

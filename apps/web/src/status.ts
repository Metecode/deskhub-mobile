import type { BridgeState } from './connection.js';

/** What to do about missing data, "" when there is nothing to do. */
export function statusHint({ link, pcOnline }: BridgeState): string {
  if (link === 'bad_origin') return "This address isn't on the bridge's list, add it to CLIENT_ORIGINS";
  if (link !== 'open') return 'Connecting to the bridge on your PC';
  return pcOnline ? '' : 'Start the companion app on your PC';
}

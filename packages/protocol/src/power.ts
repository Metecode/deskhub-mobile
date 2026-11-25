// Whether the PC's display is asleep. Source: on_pc_power in firmware/main/hub_server.c.
import type { RawMessage } from './companion.js';
import { bool } from './fields.js';

export const normalizePcPower = (raw: RawMessage): boolean => bool(raw, 'asleep');

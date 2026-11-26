// Commands from phones that the bridge carries out itself. They never reach the companion; like its
// commands, only exactly these pass (docs/plan-phase6.md).
import * as z from 'zod';
import { ID, MAX_VALUE } from './reminders.js';

export const bridgeCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bridge.bulletin.run') }),
  z.strictObject({
    type: z.literal('bridge.reminder.save'),
    id: z.string().regex(ID),
    values: z
      .record(z.string().regex(ID), z.number().finite().min(0).max(MAX_VALUE))
      .refine((values) => Object.keys(values).length <= 4),
  }),
  z.strictObject({ type: z.literal('bridge.measurements.get'), id: z.string().regex(ID) }),
]);
export type BridgeCommand = z.infer<typeof bridgeCommandSchema>;

/** A bridge command from a phone, or null when it isn't one. Never throws. */
export function parseBridgeCommand(text: string): BridgeCommand | null {
  if (!text.startsWith('{"type":"bridge.')) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const result = bridgeCommandSchema.safeParse(value);
  return result.success ? result.data : null;
}

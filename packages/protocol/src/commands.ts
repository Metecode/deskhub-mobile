// Commands the hub may send to the companion: the whitelist for phones.
//
// What the board sends (firmware/main/):
//   media         ui.c ui_send_media()
//   media_server  ui.c:411 ui_send_server(), from ui_media.c:69, ui_media.c:83 and ui_home.c:69
//   shortcut      ui_shortcuts.c tile_cb()
//   steam_launch  ui_games.c games_launch()
//   speedtest     ui_net.c run_cb()
//   alert_action  ui_alert.c send_action()
// What the companion does with them: companion/deskhub/__main__.py handle()
// (media_server at line 391, only when a media server is configured).
import * as z from 'zod';
import { ALERT_ID_MAX, MAX_TILES } from './limits.js';

const mediaCmd = z.enum(['toggle', 'next', 'prev', 'seek']);
// Seconds, used by "seek"; the board sends 0 with the others (%d, a 32-bit int).
const mediaValue = z.int32().min(0).default(0);

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('media'), cmd: mediaCmd, value: mediaValue }),
  z.object({ type: z.literal('media_server'), cmd: mediaCmd, value: mediaValue }),
  z.object({
    type: z.literal('shortcut'),
    id: z
      .int()
      .min(0)
      .max(MAX_TILES - 1),
  }),
  // Custom games use ids from 0xC0000000 up, so the full uint32 range is valid.
  z.object({ type: z.literal('steam_launch'), appid: z.uint32() }),
  z.object({ type: z.literal('speedtest') }),
  z.object({
    type: z.literal('alert_action'),
    // The board replaces every other character with "_" (hub_server.c, on_alert).
    id: z
      .string()
      .max(ALERT_ID_MAX)
      .regex(/^[0-9A-Za-z_-]+$/),
    action: z.enum(['focus', 'dismiss']),
  }),
]);
export type Command = z.infer<typeof commandSchema>;

/**
 * A command from a phone, or null when it isn't on the whitelist. Unknown fields
 * are dropped, so what comes back is safe to send on. Never throws.
 */
export function parseCommand(text: string): Command | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const result = commandSchema.safeParse(value);
  return result.success ? result.data : null;
}

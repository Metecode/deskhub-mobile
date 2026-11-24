// Protocol limits of the ESP32 board. Sources are in the upstream firmware
// (firmware/main/) at commit b78c505.

/** Version the board reports in hello_ok (hub_server.c, on_text). The companion only logs it. */
export const HUB_VERSION = '0.1.0';

/** Largest frame accepted at all, in bytes (hub_server.c, MAX_FRAME). */
export const MAX_FRAME = 300 * 1024;

/** Largest frame accepted before hello, in bytes (hub_server.c, PREAUTH_MAX). */
export const PREAUTH_MAX = 256;

/** The PC is offline after this long without a message (hub_server.c, ONLINE_TIMEOUT_MS). */
export const ONLINE_TIMEOUT_MS = 5000;

/** Shortcut tiles (hub_model.h, HUB_MAX_TILES; shortcuts.py, MAX_TILES). */
export const MAX_TILES = 16;

/** Longest alert id the board echoes back: char id[64] (hub_model.h, hub_alert_t). */
export const ALERT_ID_MAX = 63;

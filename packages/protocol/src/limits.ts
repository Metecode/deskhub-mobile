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

/** Calendar events (hub_model.h, HUB_MAX_EVENTS; calendar_feed.py, MAX_EVENTS). */
export const MAX_EVENTS = 16;

/** Covers, in pixels per side (hub_server.c, on_binary). */
export const MAX_COVER = 320;

/** Days of AI usage (hub_model.h, HUB_CLAUDE_DAYS) and models (HUB_CLAUDE_MODELS). */
export const USAGE_DAYS = 7;
export const USAGE_MODELS = 4;

/** Latency probes (hub_model.h, HUB_NET_HIST). */
export const NET_HISTORY = 60;

/** Recent games (hub_model.h, HUB_STEAM_RECENT), with a portrait each, and friends (HUB_STEAM_FRIENDS). */
export const STEAM_RECENT = 5;
export const STEAM_FRIENDS = 5;

/** Printers (hub_model.h, HUB_MAX_PRINTERS) and their filament slots (HUB_MAX_AMS). */
export const MAX_PRINTERS = 4;
export const MAX_FILAMENTS = 8;

/** GitHub (hub_model.h, HUB_GH_DAYS, HUB_GH_MONTHS, HUB_GH_REPOS). */
export const GITHUB_DAYS = 378;
export const GITHUB_MONTHS = 14;
export const GITHUB_REPOS = 4;

/** Longest alert id the board echoes back: char id[64] (hub_model.h, hub_alert_t). */
export const ALERT_ID_MAX = 63;

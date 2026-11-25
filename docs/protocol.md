# Protocol

What the bridge speaks, as of phase 2. Upstream references are to commit
`b78c505279a50f80cd40bfc86f0d9de9ac79437c`. The schemas are in `packages/protocol`.

## Companion <-> bridge: `/ws`

JSON text frames and binary picture frames. The rules are the board's
(`firmware/main/hub_server.c`).

| Rule | Value |
| --- | --- |
| Largest frame | 300 x 1024 bytes; more closes the connection (1009) |
| Largest frame before hello | 256 bytes; more closes the connection (1009) |
| Small frames before hello that aren't hello | ignored |
| Wrong token | closes the connection (1008) |
| A second companion says hello | it takes over, the first is closed (4001) |
| PC offline | 5 s without a message, or the connection closes |

Any JSON text message keeps the PC online, whatever its type. Bad JSON, invalid binary frames and
WebSocket pings don't.

The close codes are the bridge's; the board just drops the connection.

### `hello` (companion -> hub)

First message on a connection.

| Field | Type |
| --- | --- |
| `token` | string |

### `hello_ok` (hub -> companion)

Always the first message the companion receives.

| Field | Type | |
| --- | --- | --- |
| `version` | string | `0.1.0`. The companion only logs it. |

### `ping` (companion -> hub)

Keeps the PC online, nothing else. The board accepts it; the current companion never sends it. Not
relayed to phones.

### `stats` (companion -> hub)

Once a second. Source: `companion/deskhub/stats.py`, `on_stats()` in `hub_server.c`.

| Field | Type | Unit | If missing or not a number |
| --- | --- | --- | --- |
| `cpu` | number | % | 0 |
| `cpu_temp` | number | °C, < 0 unknown | unknown. **The current companion doesn't send it.** |
| `ram_used`, `ram_total` | number | GB (2^30 bytes) | 0 |
| `gpu` | number | % | no GPU |
| `gpu_temp` | number | °C, < 0 unknown | unknown |
| `vram_used`, `vram_total` | number | GB (2^30 bytes) | 0 |
| `net_down`, `net_up` | number | KB/s (1024 bytes) | 0 |
| `disk` | number | % used, system drive | 0 |
| `cpu_name`, `gpu_name` | string | | `""` |

Without an NVIDIA GPU, `gpu`, `gpu_temp`, `vram_used` and `vram_total` are left out and `gpu_name`
is `""`. `normalizeStats()` applies the last column.

### `media` (companion -> hub)

Once a second. Source: `companion/deskhub/media.py`, `on_media()`. With nothing playing only `active`
is there.

| Field | Type | |
| --- | --- | --- |
| `active`, `playing`, `can_seek` | boolean | false if missing |
| `controls` | boolean | false: can't be remote controlled. Missing means it can. |
| `title`, `artist`, `album`, `source` | string | |
| `pos`, `dur` | number | seconds; `dur` 0 is unknown |
| `art_id` | number | the id of the cover that came before, 0 for none |

### `media_server` (companion -> hub)

Once a second with a Plex or Jellyfin server, else `{"configured": false}` on connecting. Source:
`media_server.py`, `on_media_server()`. The fields of `media` for what plays there, and:

| Field | Type | |
| --- | --- | --- |
| `configured`, `online` | boolean | |
| `streams`, `transcoding` | number | how many |
| `name`, `version`, `library` | string | |
| `kind` | string | `plex` or `jellyfin` |

### `events` (companion -> hub)

On connecting and after every calendar refresh. Source: `calendar_feed.py`, `on_events()`.

| Field | Type | |
| --- | --- | --- |
| `days` | number | how far ahead it looked, 7 if missing |
| `events` | array, up to 16 | |
| `events[].start`, `.end` | number | epoch seconds |
| `events[].all_day` | boolean | from local midnight |
| `events[].title`, `.loc`, `.cal` | string | |
| `events[].color` | string | `#rrggbb`, `#7c9cff` if missing |

### `tiles` and `tile_state` (companion -> hub)

`tiles` on connecting, `tile_state` when it changes. Source: `shortcuts.py`, `on_tiles()`,
`on_tile_state()`.

| Field | Type | |
| --- | --- | --- |
| `tiles[]` | array, up to 16 | `label`, `icon` (a name from `icons.h`, else `apps`), `color` (`#2a2f3a` if missing) |
| `on` | array of numbers | the indices of the tiles that are on |

### `layout` (companion -> hub)

On connecting. Source: `pages.py` `layout_message()`, `on_layout()`. Phones keep the last one.

| Field | Type | |
| --- | --- | --- |
| `pages` | array of strings | the enabled pages; Home is always on |
| `ordered` | boolean | `pages` is in the bar's order; otherwise the order stays |
| `nav` | string | `left`, `right` or `bottom`; otherwise the bar stays, at first on the left |
| `pc_sleep` | string | while the display sleeps: `off`, `clock` or `none`; otherwise as before, at first `off` |
| `night_start`, `night_end` | number | minutes after midnight, -1 for no night mode; out of range changes nothing. Without `night_start` the night stays as it is. |
| `night_style` | string | `clock`, anything else is `off` |

### `home` (companion -> hub)

On connecting. Source: `pages.py` `home_message()`, `on_home()`, `place_grid()` in `ui_home.c`. Phones
keep the last one.

| Field | Type | |
| --- | --- | --- |
| `header` | boolean | time and date in a bar on top, and no clock widget |
| `grid[]` | array | `widget`, and the cells `x`, `y`, `w`, `h` of a grid of 5 columns by 3 rows |
| `left`, `right` | arrays of strings | two columns, for firmware from before the grid; used when `grid` is missing |

### `ai` (companion -> hub)

Every 5 seconds; `claude` from older companions is the same. Source: `claude_usage.py`,
`codex_usage.py`, `on_claude()`.

| Field | Type | |
| --- | --- | --- |
| `provider` | string | `codex`, anything else is Claude Code |
| `limits` | object | empty without a status line or live limits |
| `limits.five_hour`, `.seven_day` | object | `pct` (used), `reset` (epoch seconds). Left out when the window is over. |
| `limits.updated` | number | when the agent last reported them, epoch seconds |
| `block` | object | an estimate of the 5-hour window: `active`, `reset`, `tokens`, `messages` |
| `today` | object | `tokens`, `output`, `messages` |
| `last_hour` | number | tokens |
| `days` | array of 7 numbers | tokens per day, the last one is today |
| `models[]` | array, up to 4 | `name`, `tokens`, of today |

### `alert` (companion -> hub)

When it changes, and on connecting if there is one. Source: `claude_alerts.py`, `on_alert()`.

| Field | Type | |
| --- | --- | --- |
| `clear` | boolean | true: nothing is waiting, the rest is missing |
| `id` | string | echoed in `alert_action`; characters other than `0-9A-Za-z_-` become `_` |
| `kind` | string | `permission`, anything else waits for a reply |
| `title`, `detail`, `project` | string | |
| `agent` | string | `claude`; not used |

### `net` (companion -> hub)

Every 2 seconds. Source: `netstats.py` `message()`, `on_net()`.

| Field | Type | |
| --- | --- | --- |
| `online`, `testing` | boolean | `testing`: a speed test is running |
| `latency_ms`, `jitter_ms` | number or null | |
| `loss_pct` | number | |
| `hist` | array of up to 60 numbers | ms per probe, one every 2 s, oldest first; -1 is a lost one |
| `up_since` | number or null | epoch seconds |
| `last_drop` | object or null | `at` (epoch seconds), `dur_s` |
| `today_bytes`, `month_bytes` | number | |
| `speed` | object or null | `down_mbps`, `up_mbps`, `ping_ms`, `at` (epoch seconds) |
| `ip` | string | empty unless set up |

### `pc_power` (companion -> hub)

On connecting, right after `layout`, and when the PC's display sleeps or wakes; also just before the PC
suspends. Source: `pc_power.py`, `session()`, `on_pc_power()`.

| Field | Type | |
| --- | --- | --- |
| `asleep` | boolean | |

Every session starts with the current state, so the snapshot's copy is never out of date for longer
than the companion is away. Phones keep `asleep` while the bridge is out of reach.

### Everything else

`printer`, `steam` and `github` have no schema yet.
They, types nobody knows, and messages that don't fit their schema are relayed to phones unchanged.

### Binary frames (companion -> hub)

Little endian, RGB565 pixels. Source: `on_binary()` and `on_steam_art()` in `hub_server.c`.

| Magic | Header | Limits |
| --- | --- | --- |
| `ART1` (media cover) | magic, u32 art id, u16 width, u16 height | up to 320 x 320 |
| `ARS1` (media server poster) | same | same |
| `STM1` (Steam cover) | magic, u32 appid, u16 width, u16 height, u16 kind, u16 0 | up to 400 x 240, kind 0-2 |

The length must be exactly the header plus width x height x 2. `ART1` and `ARS1` go to phones as they
are; the last of each is kept for phones that connect later. `STM1` is only checked and logged for now.

### Commands (hub -> companion)

The only things a phone can send. Everything else is refused, and unknown fields are dropped.

| Type | Fields | Sent on the board by | Handled by |
| --- | --- | --- | --- |
| `media` | `cmd`: `toggle`, `next`, `prev`, `seek`; `value`: seconds for `seek`, else 0 | `ui.c` `ui_send_media()` | `Media.command()` |
| `media_server` | same | `ui.c:411` `ui_send_server()`, from `ui_media.c:69`, `ui_media.c:83`, `ui_home.c:69` | `__main__.py:391` `handle()`, then `media_server.py:617` `MediaServers.command()`; ignored without a media server |
| `shortcut` | `id`: 0-15, the tile's index | `ui_shortcuts.c` `tile_cb()` | `run_tile()` |
| `steam_launch` | `appid`: u32 | `ui_games.c` `games_launch()` | `Steam.launch()`, only for games it listed |
| `speedtest` | none | `ui_net.c` `run_cb()` | at most one per 2 minutes |
| `alert_action` | `id`: `[0-9A-Za-z_-]`, up to 63; `action`: `focus`, `dismiss` | `ui_alert.c` `send_action()` | `ClaudeAlerts` |

## Phone <-> bridge: `/client?token=<CLIENT_TOKEN>`

JSON text frames, up to 4 KiB from the phone, and binary cover frames to it. Companion messages arrive as they are; the bridge's
own start with `bridge.`.

| Close code | Meaning |
| --- | --- |
| 4401 | Missing or wrong token |
| 4403 | The page's origin isn't allowed |

### `bridge.snapshot`

Always first. The last `ART1` and `ARS1` frames follow it, if there are any.

| Field | Type | |
| --- | --- | --- |
| `pc_online` | boolean | |
| `messages` | array | The last message of every type, without `hello`, `hello_ok` and `ping`. Kept while the PC is offline. A cleared alert is there as `{"type":"alert","clear":true}`. |
| `weather` | object or null | `latitude`, `longitude`, `city`, `units` (`metric` or `imperial`). Phones fetch the weather themselves. null: no location is set. |

### `bridge.status`

On every change and every 5 s, online or not. A phone that hears nothing for 15 s reconnects.

| Field | Type |
| --- | --- |
| `pc_online` | boolean |

## HTTP

| Request | Answer |
| --- | --- |
| `GET /...` | The web app; without a build, `/` is a 200 with a hint |
| `POST /firmware` | 403 after reading the upload. Any other refusal makes `deskhub-flash` flash over USB. |
| `GET /screenshot`, `/tap`, `/perf` | 403 without `?token=<HUB_TOKEN>`, else 501 |

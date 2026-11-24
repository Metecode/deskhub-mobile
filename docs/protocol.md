# Protocol

What the bridge speaks, as of phase 0. Upstream references are to commit
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

### Everything else

`media`, `media_server`, `events`, `tiles`, `ai` (`claude` from older companions), `printer`,
`layout`, `pc_power`, `home`, `alert`, `tile_state`, `steam`, `net` and `github` have no schema yet.
They, types nobody knows, and messages that don't fit their schema are relayed to phones unchanged.

### Binary frames (companion -> hub)

Little endian, RGB565 pixels. Source: `on_binary()` and `on_steam_art()` in `hub_server.c`.

| Magic | Header | Limits |
| --- | --- | --- |
| `ART1` (media cover) | magic, u32 art id, u16 width, u16 height | up to 320 x 320 |
| `ARS1` (media server poster) | same | same |
| `STM1` (Steam cover) | magic, u32 appid, u16 width, u16 height, u16 kind, u16 0 | up to 400 x 240, kind 0-2 |

The length must be exactly the header plus width x height x 2. For now the bridge checks and logs
them and doesn't pass them on.

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

JSON text frames, up to 4 KiB from the phone. Companion messages arrive as they are; the bridge's
own start with `bridge.`.

| Close code | Meaning |
| --- | --- |
| 4401 | Missing or wrong token |
| 4403 | The page's origin isn't allowed |

### `bridge.snapshot`

Always first.

| Field | Type | |
| --- | --- | --- |
| `pc_online` | boolean | |
| `messages` | array | The last message of every type, without `hello`, `hello_ok` and `ping`. Kept while the PC is offline. A cleared alert is there as `{"type":"alert","clear":true}`. |

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

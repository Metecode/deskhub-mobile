# Phase 0 plan (approved)

Goal: the unmodified Desk Hub companion feeds a phone through a bridge that behaves like the
ESP32 board, end to end, with one page (PC Stats).

```
Companion (upstream, Python) --ws /ws--> Bridge (Node, on the PC) --ws /client--> Web app (React, on the phone)
```

## Upstream baseline

Pinned to **`b78c505279a50f80cd40bfc86f0d9de9ac79437c`**, the commit checked out in `../deskhub`.

The project brief named `cc47e77`. That commit is a direct ancestor, 7 commits older. Auth, `stats`
and all frame limits are the same in both; `b78c505` adds the `media_server` message and command,
the `ARS1` binary frame and the `controls` field of `media`. The newer one is used because it is
the companion that actually runs. `file:line` references below are to `b78c505`.

## What the source says

| Topic | Source | Consequence |
| --- | --- | --- |
| The companion never sends `cpu_temp` | `companion/deskhub/stats.py` | No CPU temperature with the real companion. Shown if it ever arrives. The mock doesn't send it either. |
| GPU stats are NVIDIA only; otherwise every `gpu*`/`vram*` value is left out (`gpu_name` is `""`) | `stats.py`, `hub_server.c` `on_stats` | "No GPU data" state. |
| Units: GB = 2^30 bytes, KB/s = 1024 bytes, % | `hub_model.h`, `stats.py` | Documented in the schema. |
| The board accepts `ping`; the companion never sends it | `hub_server.c` `on_text` | Keeps the PC online; not relayed, not in the snapshot. |
| Online = a companion that said hello, and a text message (any type) or a **valid** binary frame in the last 5 s. Bad JSON, bad binary frames and WebSocket pings don't count | `hub_server.c` `on_text`, `on_binary`, `hub_server_pc_online` | Same in the bridge. |
| `hello_ok.version` is only logged; only `type` is checked, on the first message received | `__main__.py` `session` | `hello_ok` with `0.1.0` is always the first message. |
| The running companion makes **no HTTP calls** to the hub. Two helper tools do: `deskhub-flash` and `deskhub-setup` | `flash_cli.py`, `setup_cli.py` | See the HTTP table. |
| Nothing upstream calls `/screenshot`, `/tap` and `/perf`; they are debug endpoints | `hub_server.c` | See the HTTP table. |

`media_server` command: sent by `ui_send_server()` (`firmware/main/ui.c:411`), called from the Media
page (`ui_media.c:69` buttons, `ui_media.c:83` seek) and the Home media widget (`ui_home.c:69`).
Handled in `Companion.handle()` (`companion/deskhub/__main__.py:391`), which passes it to
`MediaServers.command()` (`media_server.py:617`); without a configured server it is ignored.

## Protocol package

- Lenient Zod schemas for `hello`, `hello_ok`, `ping`, `stats`: every field optional and nullable,
  unknown fields kept.
- Parsing gives `known`, `unknown` (no schema yet; `media_server` among them), `mismatch` (schema
  failed) or `invalid` (not JSON). Only `invalid` is dropped. `unknown` and `mismatch` are relayed
  as they are, and `mismatch` is logged. Parsing never throws.
- `normalizeStats()` applies the board's fallbacks (`get_num` defaults, GPU present only if `gpu` is
  a number, temperatures below zero unknown).
- **Protocol behaviour is copied, screen limits are not.** Strings are never cut to the board's
  buffers; the web app uses CSS ellipsis.
- Commands are a strict whitelist: `media`, `media_server`, `shortcut`, `steam_launch`, `speedtest`,
  `alert_action`. They are re-serialised, so unknown fields never reach the companion.

## Bridge

One HTTP server on `0.0.0.0:8765`.

- **`/ws`** (companion): `maxPayload` 300 x 1024. Before hello, a frame over 256 bytes closes the
  connection; a smaller one that isn't hello is ignored. A wrong token closes. A new companion
  replaces the old one.
- **`/client`** (phones):
  - `CLIENT_TOKEN` is required; the bridge doesn't start without it, mock mode included. It guards
    the data and the commands. A wrong token closes with 4401.
  - Origin allowlist, checked exactly (scheme, host and port): the PC's own addresses
    (`localhost`, `127.0.0.1`, every LAN IPv4, the host name, the host name + `.local`) on the
    bridge port and on the Vite dev port 5173. `localhost` covers `adb reverse`. `CLIENT_ORIGINS`
    adds more. Anything else closes with 4403. Clients that send no Origin aren't browsers and
    only need the token.
  - First a `bridge.snapshot` (last message of every type and `pc_online`), then live messages.
  - A `bridge.status` heartbeat with `pc_online` every 5 s, also while the PC is offline, and on
    every change.
  - At most 4 KiB per frame; a client more than 1 MiB behind is disconnected.
- **Snapshot**: no `hello`, `hello_ok` or `ping`. `alert` keeps its last state, `clear: true`
  included. Going offline doesn't clear anything.
- **Binary frames**: `ART1`, `ARS1` and `STM1` are validated and logged. Invalid ones are dropped and
  don't keep the PC online.
- **Env**: `HUB_TOKEN`, `HUB_PORT`, `CLIENT_TOKEN`, `CLIENT_ORIGINS`.
- **HTTP**:

| Request | Answer | Why |
| --- | --- | --- |
| `POST /firmware` | Reads and drops the body, then 403 without the word "token" | `flash_cli.py` falls back to flashing over **USB** on 404, 5xx, 403 with "token", or a dropped connection. Only 403 without it and 408 stop it. |
| `GET /`, even without a build | 200 | `setup_cli.py` expects a status below 500. |
| `/screenshot`, `/tap`, `/perf` | 403 without the right token, else 501 | The board answers 403 too. No side effects. |
| Anything else | Static file or 404; 405 unless GET/HEAD | |

- **Mock mode** (`--mock`): connects to `/ws` like the companion and sends stats every second. About
  45 s on, 10 s off; the outages alternate between going silent and dropping the connection. It
  gives way to a real companion.

## Web

- React, TypeScript, Vite, CSS modules, no UI or chart library. Graphite colours from
  `ui_internal.h` and `ui_stats.c`, Inter 500/600.
- `?token=` is saved to `localStorage`, then removed from the URL with `history.replaceState`.
- Reconnects with exponential backoff (0.5-15 s). Reconnects after 15 s of silence; the heartbeat
  keeps that from happening while the PC is merely offline.
- PC Stats: four gauges, one-minute CPU/GPU history (SVG), network, disk, names, online indicator.
- Landscape first (about 2:1), 800x480, portrait as 2x2. A tap goes fullscreen. No navigation bar
  until phase 1.

## Tests

- Protocol: schemas, `normalizeStats`, commands, binary headers.
- Bridge: real sockets on port 0 with fake timers (only timers and `Date` are faked): auth, 256/257
  bytes, 300 KiB + 1, replacement, snapshot, mismatch relayed raw, offline by timeout and by
  disconnect, heartbeat while offline, valid binary keeps online and invalid doesn't, whitelist,
  token, origins, the HTTP table, the mock's outage cycle.
- Web: formatting, backoff, watchdog.

## Verification

`pnpm typecheck`, `pnpm test`, `pnpm build`; browser at 915x412, 800x480 and portrait; `pnpm start`
with and without the token; the real companion from a scratch copy; `send_over_wifi()` from
`flash_cli.py` with a dummy file (expected: DENIED); `../deskhub` stays clean.

## Commits

Branch `phase-0`, conventional commits, no push: docs (this plan), protocol, bridge companion
endpoint, bridge client endpoint and HTTP, mock mode, web connection and theme, web stats page, docs.

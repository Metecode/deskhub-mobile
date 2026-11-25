# Phase 2 plan (approved)

Goal: the AI page with its alerts, the timer, the Internet view, and a screen that goes dark with the
PC and at night.

Upstream references are to `b78c505279a50f80cd40bfc86f0d9de9ac79437c`, as before.

## What the source says

### AI (Claude Code and Codex)

| Topic | Source | Consequence |
| --- | --- | --- |
| `ai` every 5 s; `claude` from older companions is the same message. `provider` says whose numbers they are, `claude` if missing | `__main__.py` `claude_loop`, `hub_server.c` `on_claude` | One schema for both types; the last one of either counts. |
| `limits` is `{}` without a status line or live limits. Windows that have reset are left out, so a missing `five_hour` next to a `seven_day` means it expired | `claude_usage.py` `read_limits`, `ui_claude.c` `refresh_limits` | The board's five cases are copied, "as of" for readings over 10 minutes old included. |
| Without limits the card shows a local estimate of the 5-hour window (`block`) | `ui_claude.c` | Same. |
| Colour by level: under 50 % good, under 80 % amber, else red | `ui_level_color` | Same. |
| The agents' logos are their owners' trademarks | `logos.c`, upstream README | Not copied. The `auto_awesome` icon in the agent's colour (`#d97757`, `#10a37f`), and its name. |

Checked with the real companion: `ai` has every field above, with empty `limits` on this PC.

### Alerts

| Topic | Source | Consequence |
| --- | --- | --- |
| An alert covers the claude card on Home and the history card on the AI page, and puts a dot on the AI tab. It doesn't take over the screen | `ui_alert.c` | Same. If Home has no claude card there's only the dot. A one-cell card's strip spreads over its neighbours (320 px). |
| *Show on PC* sends `focus`, *Not now* sends `dismiss`; both hide it at once. A new message shows it again | `ui_alert.c` | Same. Commands are on the whitelist already. |
| `focus` doesn't end a permission alert on the companion, so it stays in the snapshot | `claude_alerts.py` | The phone remembers the alert it hid, so that reconnecting doesn't bring it back. `clear` or a different alert forgets it. |
| Ids are cleaned to `[0-9A-Za-z_-]` before they are echoed | `hub_server.c` `on_alert` | Same, or the whitelist would refuse them. |
| A new alert wakes the screen. With the clock showing, the board only resets the idle timer and the clock stays on top | `display_wake`, `ui_saver.c` | **Different on purpose**: an alert also hides the clock, or it couldn't be seen. |
| Alerts need hooks in Claude Code's settings (`install_claude.py hooks`), limits a status line (`install_claude.py statusline`) or `live_limits` | upstream README | Nothing to do here. They change `~/.claude/settings.json`, so they are the user's to install. |

### Timer

| Topic | Source | Consequence |
| --- | --- | --- |
| Runs on the board alone; presets 1, 5, 10, 15, 25, 45; starts at 25 | `ui_timer.c` | Runs on the phone alone. |
| Choosing a preset while running restarts it, otherwise it only sets it | `preset_cb` | Same. |
| While set, the tab shows the time left instead of its icon | `ui_rail_set_text` | Same. |
| The end shows a full-screen card with *Again* and *Done*, and wakes the screen | `show_done` | Same. |
| Kept in RAM only | `ui_timer.c` | **Different on purpose**: kept in `localStorage`, as a page gets reloaded more easily than a board. It ends by the clock, also after a nap of the browser's timers. |
| The board has no sound | | **Addition**: a short beep and a vibration, see [Sound](#sound). |

### Internet

| Topic | Source | Consequence |
| --- | --- | --- |
| A view of the Stats page with a *PC / Internet* switch, only while the `network` page is on. The Home `net` widget opens it | `ui_stats.c`, `ui.c` `ui_show_page` | Same. |
| `net` every 2 s: 60 probes make the 2 minutes of the chart, `-1` is a lost one and a gap | `netstats.py`, `on_net` | Same. The scale is the worst sample, at least 50 ms. |
| `latency_ms`, `jitter_ms`, `up_since`, `last_drop` and `speed` may be `null` | `netstats.py` `message` | The board's fallbacks. |
| A speed test uses about 35 MB; the companion ignores requests within 2 minutes of the last, without an answer | `__main__.py` `speedtest` | "Starting..." until the next `net` message, as on the board. **Addition**: the button stays locked for 2 minutes after the phone's last request, across a reload too. |
| Live rates are KB/s of 1024 bytes, times 8.192 / 1000 for Mbps | `net_refresh_live` | Same. |

### Sleep and night mode

| Topic | Source | Consequence |
| --- | --- | --- |
| `pc_power.asleep` with `layout.pc_sleep` (`off`, `clock`, `none`); night from `night_start` to `night_end` with `night_style`. The PC's sleep goes before the night | `display.c` `dark_mode` | Same, worked out once a second. |
| Dark starts at once; a touch wakes it for 60 s and does nothing else. Awake again by itself when the reason is gone | `idle_check`, `touch_cb` | Same: the dark layer takes the touch. |
| The night is kept on the board and works without the PC; `pc_sleep` and `asleep` aren't | `load_night` | Night in `localStorage`, by the phone's clock. |
| `pc_power` is sent just before the PC suspends, which takes the bridge with it | `pc_power.py` | The phone keeps `asleep` when the link drops, and stays dark until a message says otherwise. |
| `off` turns the backlight off | `board_backlight` | A page can't. A black layer over everything: dark on an OLED screen, a faint glow on an LCD. Really off is for phase 4. |
| `clock` is a large dim clock that moves every minute | `ui_saver.c` | Same. |

| On waking, `on_pc_power(False)` sends `asleep: false`; every session sends the current state right after `layout`, `false` from a companion that just started | `pc_power.py` `_set`, `__main__.py` `on_pc_power`, `session` | Waking always reaches the phone, over the old connection or the next one. The bridge doesn't have to clear `pc_power`; a test keeps it that way. A snapshot without `pc_power` (the bridge was restarted, so the PC is on) means awake. |

### Sound

For the timer's end and for new alerts, always on.

- The `AudioContext` is made and resumed in a touch: the timer's start, and for alerts any touch on the
  page.
- After a reload without a touch the browser plays and vibrates nothing. That fails silently; the
  *Time's up* card and the alert show either way.
- An alert sounds once: not again for the same one, not for one that was hidden, nor for one that was
  already there when the phone connected and that it has seen.

## Protocol package

- Lenient schemas and normalizers for `ai` (and `claude`), `alert`, `net` and `pc_power`. Left without
  a schema: `printer`, `steam`, `github`.
- `normalizeLayout` also reads `pc_sleep` and the night fields: out of range (-1 to 1439) changes
  nothing, as on the board; a layout without `night_start` leaves the night alone.

## Bridge

No changes but the mock: usage that grows, an alert now and then that obeys its buttons, latency
with lost probes, a speed test, and the PC's display going to sleep for a while.

## Web

- **AI page**: two limit cards, today, seven-day bars, models today.
- **Home**: the claude and net widgets replace their placeholders, with their one-cell versions.
- **Alerts**: strip on Home, panel on the AI page, dot on the tab.
- **Timer page**, its tab text and the *Time's up* card.
- **Stats**: the switch and the Internet view.
- **Dark layer**: above everything but *Time's up*, which wakes it.

## Tests

- Protocol: schemas, normalizers, the fallbacks, alert ids.
- Web: every limit case, countdowns, "as of", token and byte formats; hiding and returning alerts,
  across a reconnect too; the timer across pause, reload and a late wake; chart gaps; night across
  midnight, PC sleep before night, 60 s wake, staying dark when the link drops, waking on the next
  `pc_power` or snapshot; sound without user activation, and *Time's up* without sound; the speed
  test's lock.
- Bridge: a new session's `pc_power` replaces the old one in the snapshot; the mock.

## Verification

`pnpm typecheck`, `pnpm test`, `pnpm build`; browser at 915x412, 800x480 and portrait, with each bar
position; the real companion: AI page, Internet view and one speed test; a fake session file in
`~/.deskhub/claude_sessions` for an alert and its buttons, removed afterwards; turning the PC's
display off; `../deskhub` stays clean; then the phone, by the user.

Not verifiable here without Codex and without limits installed: the Codex view and the limit bars
with real numbers (tests and mock).

## Commits

Branch `phase-2` from `phase-1`, conventional commits: docs (this plan), protocol, mock, AI page and
widget, alerts, timer, Internet, dark layer, docs.

## Decided on approval

1. Timer: beep and vibration. The same for alerts.
2. Black layer for `off` as above. The user's phone, a Galaxy A52, has an OLED screen (Super AMOLED),
   so it is really dark. Burn-in is for phase 4 (see `CLAUDE.md`).
3. How the PC wakes is checked in the source, see above.
4. The speed test is locked for 2 minutes on the phone.

## Not in this phase

Steam, printers, GitHub (3); keeping the screen on or really off, opening without the PC (4).

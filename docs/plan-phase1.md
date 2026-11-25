# Phase 1 plan (approved)

Goal: the phone is useful as a desk screen. Home, Media, Calendar, Weather and Shortcuts, with the
board's navigation bar to switch between them and PC Stats.

Upstream references are to `b78c505279a50f80cd40bfc86f0d9de9ac79437c`, as in phase 0.

## What the source says

| Topic | Source | Consequence |
| --- | --- | --- |
| The companion sends **no weather**. The board fetches it from Open-Meteo itself, so it goes on while the PC is off | `weather.c` | The phone fetches it, with the same query. |
| Location, city, units and 12/24 h are firmware settings | `Kconfig.projbuild` | Location, city and units go in `.env`; the bridge passes them on. 12/24 h follows the phone. |
| Weather every 15 min, after a failure every 60 s, 10 s timeout | `weather.c` `weather_task` | Same. |
| Covers come before the message that names them; a cover shows only while its id equals `art_id` | `__main__.py` `media_loop`, `ui.c` `ui_media_has_art` | Same check in the web app. A mismatch shows the placeholder. |
| After a reconnect the companion sends the current cover again, but not on request | `__main__.py` `session` | The bridge keeps the last `ART1` and `ARS1` for phones that connect later. |
| `ART1` and `ARS1` are at most 320 x 320 | `hub_server.c` `on_binary` | Already checked by `parseArtFrame()`; now tested for both, in both directions. |
| When the PC goes offline the board sets `media.active` to false. It keeps events, tiles and the media server's state | `ui.c` `tick_cb` | Same. |
| Shortcut tiles are dimmed and disabled while the PC is offline | `ui_shortcuts.c` | Same; media controls too. |
| `shortcut` carries only the tile's index; what it does stays on the PC | `ui_shortcuts.c` `tile_cb`, `shortcuts.py` `run_tile` | Nothing to add to the whitelist. All commands of this phase are already on it. |
| `tile_state` has the indices of lit tiles, sent only when it changes | `__main__.py` `refresh_lit` | The last one counts. |
| `layout` has the enabled pages in order, and the bar's place. The board keeps it, and `home`, across restarts | `pages.py` `layout_message`, `ui.c` `load_layout` | Kept in `localStorage`. Before the first one: the board's default pages, and the bar on the left (`pages.py` `nav_position`). |
| `home` has a 5 x 3 grid; older companions send two columns. A widget is hidden while its page is off, the clock widget while the top bar is on | `pages.py` `home_grid`, `ui_home.c` `place_grid`, `widget_enabled` | Same, on a CSS grid. Columns convert as in `columns_to_grid`. |
| The Internet page is a view inside Stats, not a tab | `ui.c` `apply_layout` | No tab for it. The view itself is phase 2. |
| Ended events are dropped every 60 s; events are sorted again on arrival | `ui.c` `tick_cb`, `event_cmp` | Same. |
| `events` carries `days`, how far ahead it looked | `__main__.py` `events_message` | Used in "No more events in the next 7 days". |
| The companion folds text to ASCII. Letters without a decomposition disappear: `Işıklı Yağmur` arrives as `Iskl Yagmur`. There is **no setting** for it. Folding comes first, then a cut to a number of **characters**; bytes are only cut on the board, by its C buffers | `text.py` `ascii_fold` | Optional launcher, see below. Longer UTF-8 text doesn't bother the bridge. |
| Covers are 280 x 280 | `media.py` `ART_SIZE` | A little soft on a phone. Can't be fixed here. |

## Protocol package

- Lenient schemas for `media`, `media_server`, `events`, `tiles`, `tile_state`, `layout` and `home`.
  They leave `TYPES_WITHOUT_SCHEMA`.
- A normalizer for each, with the board's fallbacks (`on_media` and so on): a missing `controls`
  means there are controls, colours default to `#7c9cff` (events) and `#2a2f3a` (tiles), `days` to 7.
  Limits that are protocol rather than screen size stay: 16 events, 16 tiles, the 5 x 3 grid.
- `bridge.snapshot` gets a `weather` field: `null`, or `latitude`, `longitude`, `city` and `units`
  (`metric` or `imperial`).

## Bridge

- **Covers**: valid `ART1` and `ARS1` frames are relayed to phones as binary frames, unchanged. The
  last of each is kept and sent right after the snapshot. `STM1` is still only logged (phase 3).
- **Env**: `WEATHER_LATITUDE`, `WEATHER_LONGITUDE`, `WEATHER_CITY`, `WEATHER_UNITS`
  (`metric`, the default, or `imperial`). A bad value stops the bridge with a message. The bridge
  itself never talks to Open-Meteo.
- **Mock mode**: media with a generated cover that changes with the track and obeys the controls,
  a media server, events, tiles with a lit one, a layout and a home grid.

## Web

- **Navigation bar** (`ui.c` `build_rail`): left, right or bottom as `layout` says; always bottom in
  portrait. The order is the companion's. Only pages that exist get a tab, so AI, printer, timer,
  games and GitHub appear as their phases arrive. PC and link status at the end. The Calendar tab
  has the board's dot (`ui_calendar_badge`).
- **Home** (`ui_home.c`): the companion's grid, with the top bar when it asks for it. Widgets: clock,
  events, weather, media, stats. The others (claude, printer, game, net, github) are placeholders
  until their phase. Tapping a widget opens its page. In portrait the widgets are a list.
- **Media** (`ui_media.c`): cover, source, title, artist, album, seek bar, previous, play/pause, next.
  The position advances by itself between messages; a seek is sent on release. With a media server
  configured, the board's split view.
- **Calendar** (`ui_calendar.c`): events grouped by day, running ones outlined.
- **Weather** (`ui_weather.c`): now, 24 hours, 6 days. Fetched on the phone from Open-Meteo with the
  board's query and timing, without a referrer. The settings and the last data are in
  `localStorage`; hours and days that have passed are left out. Without a location nothing is
  fetched and the page says what to set.
- **Shortcuts** (`ui_shortcuts.c`): the board's columns (2, 3 or 4 by count), lit tiles, unknown icons
  fall back to `apps`.
- Icons: Material Icons from `@fontsource/material-icons`, served by the bridge (128 KB once). The
  license is checked against upstream's copy (Apache 2.0) and goes in `NOTICE`, with Open-Meteo's
  attribution (CC BY 4.0).
- Covers: RGB565 drawn to a canvas. Only the latest of each kind is kept.
- The phone's clock and time zone. 12/24 h from the phone's locale. The text stays English, like the
  board's.
- A tap still goes fullscreen, except on controls.

Weather goes on while the PC is off, as long as the page is open: loading the page needs the bridge.
Opening it without the PC needs a service worker, and so HTTPS or an app; that is phase 4.

## Optional launcher

`tools/run-companion.py` starts the unmodified companion with `deskhub.text.ascii_fold` replaced, so
text keeps its letters. It keeps the whitespace clean-up and the length limit and only leaves out the
folding. Every module does `from .text import ascii_fold`, so it patches before importing anything
else. The tray's *Restart* and `deskhub-install` start `-m deskhub` and lose the patch. Optional, and
described as such in the README; nothing depends on it.

## Tests

- Protocol: every schema and normalizer, with messages the companion builds; the grid; 320 and 321
  pixel covers.
- Bridge: cover relayed, kept and replayed after the snapshot; invalid and oversized ones not;
  weather settings read, checked and sent.
- Web: weather query, parsing, 15 min, 60 s, 10 s, old data kept on failure and across a reload, off
  without a location (no real requests); RGB565 conversion, cover id check, position clock, event
  grouping (midnight, running, all-day), page order and default bar, weather icons and texts, 12/24 h.

## Verification

`pnpm typecheck`, `pnpm test`, `pnpm build`; browser at 915x412, 800x480 and portrait, with each bar
position; the real companion, with and without the launcher: media with covers and controls from a
player, a local `.ics` file, a harmless shortcut; `../deskhub` stays clean; then the phone, by the
user.

Not verifiable without a Plex or Jellyfin server: the split view and `ARS1` (tests and mock only).

## Commits

Branch `phase-1` from `phase-0`, conventional commits, no push: docs (this plan), protocol, bridge
covers and weather settings, mock mode, web navigation, then one for each page, launcher, docs.

## Not in this phase

AI, alerts, timer, internet view, sleep and night mode (2); Steam, printers, GitHub, with their pages
and Home widgets (3); kiosk, opening without the PC (4).

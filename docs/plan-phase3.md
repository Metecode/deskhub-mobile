# Phase 3 plan (approved)

Goal: the games, printer and GitHub pages with their Home widgets. After that nothing on Home is a
placeholder, and no message is without a schema.

Upstream references are to `b78c505279a50f80cd40bfc86f0d9de9ac79437c`, as before.

## What the source says

### Games

| Topic | Source | Consequence |
| --- | --- | --- |
| `steam` is checked every 2 s, sent when it changes and at least every 60 s. `session_s` alone doesn't count as a change | `__main__.py` `steam_loop`, `_steam_key` | The phone counts the session on from the message's arrival, as the board does. |
| On this PC `steam` already arrives without Steam: `found` is true, from the built-in presets (Minecraft and others) | `game_presets.py`, `custom_games.py`; checked | One page for Steam and other games, as on the board. |
| The `games` page is on by itself only with Steam or a `[[games]]` block | `pages.py` `enabled_pages` | Nothing to do. |
| `STM1` frames: kind 0 header 340 x 159, 1 thumbnail 64 x 96, 2 portrait 96 x 144, at most 400 x 240 | `steam.py` `KIND_SIZES`, `hub_server.c` `on_steam_art` | The bridge checks them already and drops them; from now on it relays them. |
| The board keeps the last header, the last thumbnail and 5 portraits. A new portrait takes its game's slot, else one no recent game uses | `ui_games.c` `ui_set_steam_art` | Same in the bridge (for phones that connect later) and on the phone. About 260 KB in all. |
| A cover shows only for its own game: header of the one played, portrait of a recent one, thumbnail on Home | `games_refresh`, `home_refresh_game` | Same. |
| Playing: cover, time, total (only once it is 10 minutes above the session), friends in a game as a count. Not playing: friends by name, as many as fit | `games_refresh`, `games_total_worth_showing` | Same. |
| A tap on a recent game starts it on the PC; the companion refuses games that aren't in its last message | `tile_cb`, `steam.py` `launch` | Same, at one tap. `steam_launch` is on the whitelist already. **Addition**: after a launch every game is locked for 5 seconds on that phone. |
| The session goes on counting while the PC is offline | `games_session_s` | **Different on purpose**: it stops when the PC is offline. And the tiles can't be tapped then, as elsewhere. |
| With all 5 portraits of recent games, the board drops a sixth | `ui_set_steam_art` | Can only happen when a frame comes before its `steam` message. **Different on purpose**: the one that arrived first goes. |
| Covers are sent at 96 x 144 | `KIND_SIZES` | Soft on this phone. Fetching them from Steam's servers would tell Steam what the phone shows, so no. |

### Printers

| Topic | Source | Consequence |
| --- | --- | --- |
| `printer` is sent when it changes (checked every 2 s) and at least every 30 s; up to 4 printers of any brand in one shape | `__main__.py` `printer_loop`, `printer_types.py`, `on_printer` | One page for all brands. |
| Temperatures may be `null` | `offline_message`, `get_temp` | `--`. |
| Shown: the one picked by tapping the name, else the first that prints, pauses or prepares, else the first | `printer_refresh` | Same. |
| The first tap goes to the second printer even when the second is already on the screen | `next_cb` | **Different on purpose**: it goes to the one after the one shown. |
| "Done at" is worked out when a message arrives | `printer_refresh` | From the message's arrival, so that it doesn't creep. |
| Up to 8 filament slots; dark ones get an edge, the active one a ring | `printer_refresh` | Same. Their labels show above a bottom bar too, where the board has no room for them. |
| Slicing counts as idle on Home and not on the page | `home_refresh_printer`, `state_text` | Copied as it is. |
| There are no commands: the board can't pause or stop a print | `ui_printer.c` | Nothing to send. |

### GitHub

| Topic | Source | Consequence |
| --- | --- | --- |
| `github` is sent when it changes, asked every 15 minutes | `github.py` `poll` | Same. |
| `levels` has a digit a day, oldest first; with more than 378 the oldest are cut, and months and the first weekday shift along | `on_github` | Same. |
| Greens of their own, or shades of the accent with `accent` | `ui_github.c` `level_color` | Same. |
| As many weeks as fit, the newest on the right, today outlined; month labels that would crowd are left out | `github_place_months`, `layout_page` | Same, as SVG. Upright, where 53 weeks would be too small, the newest that fit. |
| Streak, this week beside last week, top repositories | `ui_github.c` | Same. |
| The Home widget has two forms, by height: chart with totals beside it, or chart with months and a row of numbers | `layout_github` | Same. |
| The Home widget needs a token and shows without its page | `pages.py`, `W_PAGE` | As in phase 1: it opens the page only when that is on. |
| The token is the user's, and goes into the Windows credential store (`deskhub-setup github`) | `github.py` | Nothing to do here. |

## Protocol package

- Lenient schemas and normalizers for `steam`, `printer` and `github`. `TYPES_WITHOUT_SCHEMA` goes:
  types nobody knows are still relayed.
- `parseArtFrame` knows `STM1` already.

## Bridge

- `Hub` keeps and relays `STM1`: one header, one thumbnail, up to 5 portraits. Which one a new portrait
  replaces, in this order: its own game's; none while there's room; the oldest of a game that isn't in
  the last `steam` message's `recent`; the oldest. "Oldest" is by arrival. The phone has the same rule
  (one function, in the protocol package).
- The frames follow the snapshot like the other covers.
- Mock: a game that starts and stops, launches that work, two printers (one prints, one goes offline), a
  year of contributions.

## Web

- **Games page** and **game widget**: cover, play button, one-cell version.
- **Printer page** and **printer widget**.
- **GitHub page** and **GitHub widget**: one chart component for both.
- Three tabs, so up to eleven. A tab is at least 44 CSS pixels long along the bar (and the bar is wider
  than that). When they don't fit, the bar scrolls along its length, with the selected tab kept in view
  and its edges faded; nothing shrinks. The status icons stay put.
- The placeholders of phase 1 go.

## Tests

- Protocol: schemas, normalizers and their fallbacks; GitHub's cut to 378 days with the shifted months;
  app ids above 2^31; the rule for portraits, the sixth included.
- Bridge: `STM1` relayed and after the snapshot; the portraits' slots; frames that are too large still
  refused.
- Web: the lock after a launch; session time, also after the PC goes offline; playtimes and "ago"; which cover belongs where;
  which printer shows, and tapping through them; "Done at" that stays put; every printer state; the
  chart's columns, months and today; counts and changes.

## Verification

`pnpm typecheck`, `pnpm test`, `pnpm build`; browser at 915x412, 800x480 and portrait, with each bar
position and all eleven tabs. The real companion:

- **Games**: no Steam on this PC, so a `[[games]]` entry in the test companion's `config.toml` with a
  picture and a harmless program (Notepad). That gives real `STM1` frames, a real session and a real
  launch. Steam itself isn't verifiable here.
- **Printers**: no printer, so a small fake Moonraker server on this PC, which stays in the repository
  as `tools/fake-moonraker.mjs` (`type = "moonraker"`, `host = "127.0.0.1"`). That runs the companion's real printer code. Bambu and the other brands give
  the same shape, but aren't tried.
- **GitHub**: with the token the user has added.

The test entries in the companion's `config.toml` are taken out again afterwards, `../deskhub` stays clean; then the phone, by the user.

## Commits

Branch `phase-3` from `phase-2`, conventional commits: docs (this plan), protocol, bridge, mock, games,
printers, GitHub, docs.

## Decided on approval

1. In use: GitHub here; Steam on the user's own computer, to be tried there. Printers: tests, the mock and
   the fake server.
2. The GitHub token is the user's (fine-grained, read-only).
3. One tap launches, with the lock after it.
4. The bar's tap targets and its scrolling, the portraits' rule and the fake server in the repository, as
   above.

## Not in this phase

Keeping the screen on or really off, burn-in, opening without the PC, kiosk (4).

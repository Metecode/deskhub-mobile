# Phase 5 plan (approved)

Goal: a layout of its own instead of the board's, everything in Turkish, and Claude's logo on its tab.
Until now `CLAUDE.md` took the look from the firmware; this phase ends that. The protocol, what is shown and
its limits still come from the source.

Mock-ups with made-up data: [Home](mockups/home.png), [Claude](mockups/claude.png),
[All](mockups/all.png), [Home upright](mockups/home-portrait.png). The numbers are placeholders, and a
picture isn't pixel-exact.

## Why

The board is 800 x 480. The phone is 915 x 412 (or 412 x 915), OLED, and looked at from further away. The
board's bar of icons without names takes a side, the clock is small or gone on most pages, and 11 tabs have
to be scrolled.

## The layout

| Part | What it is |
| --- | --- |
| **Panel** | About a quarter of the screen, on every page: the time, large; the date; the weather; the next event; the connection. The weather and the event open their pages. An alert takes the weather's and the event's place, with its two buttons, wherever one is. A running timer shows under the clock. |
| **Stage** | The page. Home is still the companion's grid (`[home]`, 5 x 3), without its header: the panel has the clock. The weather's and the events' widgets are left out, as the panel has both; a neighbour of the same width or height takes their cells. |
| **Dock** | Named tabs under the stage: the first five pages in the companion's order, and *All*. With six pages or fewer there is no *All*. No scrolling any more. |
| **All** | The rest as large tiles, each with one line of its state, and the diagnostics. |

- `nav` keeps a meaning: `left` and `right` are the panel's side; `bottom` makes it a line across the top, for
  a wider stage. Upright, the panel is on top and the dock at the bottom.
- Pure black behind everything (those pixels are off), cards one shade above it, no borders, blur or shadows.
  One colour per subject (Claude, PC, calendar, ...) for its bars and title, always next to a name or a number.
- Text: 13 px and up, 4.5:1 and up; touch targets 44 px and up; the same at all three sizes. Motion: presses
  and bars only, none with `prefers-reduced-motion`.
- Burn-in: the panel is what stands still now, so it takes the header's place in dimming and shifting. The
  large digits are the brightest thing on the screen: an off-white, a third darker after the 2 minutes.

Rules come from the `ui-ux-pro-max` skill (*Dark Mode (OLED)*, *Bento Box Grid*, at most five named tabs). Its
first proposal, glassmorphism, was drawn as well (`mockups/home-glass.png`) and not taken.

## The connection's icon

In the panel, without words; it opens the diagnostics.

| Looks like | Means |
| --- | --- |
| Three green arcs | Quick answers from the bridge |
| Two orange arcs | Slow ones |
| One red arc | Very slow ones, or some that didn't come |
| Grey with a red line through it | No connection to the bridge |
| A crossed-out PC next to it | The bridge is there, the companion isn't. Nothing is there while it is: the arcs are enough then. |

A page can't read the Wi-Fi's signal strength: Android's browsers don't tell. What it can measure is what that
leads to, the time an answer takes: a `bridge.ping` every 5 seconds while the page is visible, which the bridge
answers itself and never passes on. The median of the last ones counts, and a change must last, so that it
doesn't flicker. Where the limits lie is set on the phone, near the router and far from it: its Wi-Fi saves
power and adds to the time. The mock-up: [wifi](mockups/wifi.png).

## The pages

All are drawn anew for the stage (about 655 x 330): PC, Internet, Claude, calendar, weather, media,
printers, timer, games, GitHub, shortcuts, and Home's widgets in all sizes the companion may send. The logic
(`usage.ts`, `agenda.ts`, ...) and its tests stay; this phase changes components and CSS.

## Turkish

| Topic | Consequence |
| --- | --- |
| Every text of the app, `aria-label`s included | One file, `text.ts`, typed; no text left in components. A test looks for others. |
| Dates, times, numbers | `tr-TR`: 24 hours, "25 Kasım Çarşamba", "%38", "63,2 Mn" |
| What the companion sends in English (Claude's alerts, limits of "as of") | Known sentences are translated; others are shown as they are |
| Names the user wrote (tiles, calendars, events) | As they are |
| `deskhub-mobile.cmd`, its QR page, the bridge's messages for the user | Turkish as well; the script has to be saved with a BOM for Windows PowerShell 5.1 |
| Code, comments, documents | English, as before |

Decided: Turkish only. A second language would be a second file later.

## Claude's logo

The path from [Simple Icons](https://simpleicons.org) (CC0), as the board itself shows it. The logo is
Anthropic's trademark and only names the product; `NOTICE` gets a line. While Codex is shown, the neutral icon
stays. Other brands' logos aren't part of this.

## Tests

The dock's choice of tabs; the cells of left-out widgets; the connection's levels (median, lost answers, lasting
changes) and that `bridge.ping` never reaches the companion; the panel's content (alert, timer, event, offline); text: no English left, plurals;
Turkish dates and numbers; upper case with a dotted *İ* (`toLocaleUpperCase('tr')`, CSS `text-transform` with
`lang="tr"`).

## Verification

`pnpm typecheck`, `pnpm test`, `pnpm build`; every page with the mock at all three sizes and with `nav` left,
right and bottom, in screenshots, with contrast and sizes measured; the real companion; then the phone, by the
user.

## Commits

Branch `phase-5` from `phase-4`: docs, Turkish, tokens and frame (panel, dock, All), Home and its widgets, the
pages in groups, launcher, docs. The app works after each of them.

## Questions

Answered by the user: the layout as in the mock-ups, with the connection's icon instead of "PC online"; weather
and events only in the panel, which open their pages; Turkish only; phases 0 to 4 into `main` first, with the
tag `v0.2.0`.

The style: flat on black, not glass. Glass needs a coloured background, so no pixel is off and the same coloured
areas stand still all day (burn-in), and `backdrop-filter` is drawn anew whenever something moves behind it.

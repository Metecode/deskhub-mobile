# deskhub-mobile

An unofficial community client for [Desk Hub](https://github.com/zacharyinserra/deskhub) (MIT): an
old Android phone (Android 14) in the browser replaces the ESP32 display board. The upstream
companion is used **unmodified**.

## Architecture

```
Companion (upstream, Windows, Python) --ws /ws--> Bridge (Node, on the PC) --ws /client--> Web (React, phone, fullscreen)
```

- The companion connects to `ws://127.0.0.1:8765/ws` because of `[hub] host = "127.0.0.1:8765"` in
  its `config.toml`.
- `packages/protocol`: Zod schemas and types shared by the bridge and the web app. No build step;
  it is consumed as TypeScript source.
- `apps/bridge`: Node + ws. Behaves like the board on `/ws`, serves phones on `/client` and the
  built web app on `/`.
- `apps/web`: React + Vite, plain CSS modules.

## Upstream

- Checked out in `../deskhub`, pinned to **`b78c505279a50f80cd40bfc86f0d9de9ac79437c`**. Extract
  everything from this commit. (The original brief said `cc47e77`, an ancestor 7 commits older;
  see `docs/plan-phase0.md`.)
- Board behaviour: `firmware/main/hub_server.c`, `firmware/main/hub_model.h`.
- Companion side: `companion/deskhub/__main__.py` (`session()`, `handle()`).
- What the pages show: `firmware/main/ui_*.c`, `docs/screenshots/`. How they look is our own since phase 5.

## Rules

- Never modify anything in `../deskhub`.
- Take message fields, units and limits from the source; never guess.
- Copy the board's protocol behaviour, not its screen limits: no cutting text to C buffer sizes,
  use CSS ellipsis.
- A companion message that fails its schema is still relayed as it is. Commands from phones are
  strict: only the whitelist reaches the companion.
- Code, comments and docs in English. What the user reads is Turkish and only in `apps/web/src/text.ts`.
- Small conventional commits. Don't push.

## Commands

`pnpm dev` (mock bridge + Vite), `pnpm build`, `pnpm start` (real mode), `pnpm test`,
`pnpm typecheck` (not with `-s`: that hides its errors).

## Phases

- **0: PoC.** Bridge, protocol, PC Stats. Plan: `docs/plan-phase0.md`.
- **1:** Home (the companion's grid), media, calendar, weather, shortcuts. Plan: `docs/plan-phase1.md`.
- **2:** Claude/Codex, alerts, timer, internet, sleep and night mode. Plan: `docs/plan-phase2.md`.
- **3:** Steam, printers, GitHub: pages and Home widgets. Plan: `docs/plan-phase3.md`.
- **4:** Kiosk, finishing touches. Plan: `docs/plan-phase4.md`. OLED burn-in (the phone is a Galaxy A52, Super AMOLED): shift the
  pixels now and then, dim static elements such as the navigation bar and the clock.

- **5:** A layout of its own (panel, stage, dock), Turkish, Claude's logo. Plan: `docs/plan-phase5.md`.

## Where we are

Phases 0 to 4 are in `main`, tag `v0.2.0`. Phase 5, branch `phase-5` (from `main`):

- [x] Plan approved and written down
- [ ] Web: Turkish
- [ ] Web: panel, stage, dock, All; tokens
- [ ] Web and bridge: the connection's icon
- [ ] Web: Home and its widgets
- [ ] Web: the pages
- [ ] Claude's logo
- [ ] Launcher, QR page and the bridge's messages in Turkish
- [ ] README, docs/protocol.md
- [ ] Verified with the mock and the real companion, at all sizes
- [ ] Verified on the phone (by the user)

Phases 0 to 2 are done and verified on the phone by the user (branches `phase-0` to `phase-2`).
Phase 3, branch `phase-3`:

- [x] Plan approved and written down
- [x] Protocol: schemas, normalizers, portraits
- [x] Bridge: game covers
- [x] Bridge: mock mode
- [x] Web: navigation bar
- [x] Web: games page and widget
- [x] Web: printer page and widget
- [x] Web: GitHub page and widget
- [x] `tools/fake-moonraker.mjs`
- [x] README, docs/protocol.md
- [x] Verified with the real companion (a custom game with covers and a launch, the fake printer, real GitHub data)
- [x] Verified on the phone (by the user)

Update this list with every step.

Phase 4, branch `phase-4` (from `phase-3`):

- [x] Plan approved and written down
- [x] Web: diagnostics page
- [x] Way A (Chrome's flag) tried on the phone (by the user): it works, so no HTTPS
- [x] Web: wake lock
- [x] Web: service worker, manifest, saved calendar
- [x] Web: burn-in (pixel shift, dimming, Time's up)
- [x] Web and bridge: updates, error note
- [x] `tools/autostart.ps1`
- [x] CI
- [x] `deskhub-mobile.cmd` (`tools/launch.ps1`): set-up and start with a double-click (asked for by the user)
- [x] README, docs/protocol.md
- [x] Verified in a desktop browser
- [ ] Verified on the phone (by the user)
- [x] One pull request into `main`, tag `v0.2.0`

Next: the user tries the rest of phase 4 on the phone (overnight, home screen, opening without the PC).

Not verified yet:

- From phase 1: the split Media page with a real Plex or Jellyfin server; `ARS1` from a real
  companion (unit tests only); how the phone looks while the PC is offline.
- Phase 2: limit bars with real numbers and Codex (no status line or Codex on this PC; tests and a fake
  companion only); alerts from real hooks (tried with a session file by hand, so "Show on PC" had no
  window to show); the PC's display really sleeping and waking (the PC has Modern Standby, so it wasn't
  turned off by the agent; a fake companion only); the beep and the vibration on the phone (a desktop
  browser only).
- Phase 4: the renewal of Claude's sign-in through the VS Code extension's `claude`; the firewall prompt of
  `launch.ps1`; a real sign-in to Windows with `autostart.ps1`.
- Phase 3: Steam itself (recent games, friends, covers from its servers): to be tried on the user's own
  computer, as there is no Steam on this one. Real printers, Bambu in particular.

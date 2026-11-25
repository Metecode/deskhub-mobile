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
- Look: `firmware/main/ui_internal.h`, `firmware/main/ui_*.c`, `docs/screenshots/`.

## Rules

- Never modify anything in `../deskhub`.
- Take message fields, units and limits from the source; never guess.
- Copy the board's protocol behaviour, not its screen limits: no cutting text to C buffer sizes,
  use CSS ellipsis.
- A companion message that fails its schema is still relayed as it is. Commands from phones are
  strict: only the whitelist reaches the companion.
- Code, comments and docs in English.
- Small conventional commits. Don't push.

## Commands

`pnpm dev` (mock bridge + Vite), `pnpm build`, `pnpm start` (real mode), `pnpm test`,
`pnpm typecheck`.

## Phases

- **0: PoC.** Bridge, protocol, PC Stats. Plan: `docs/plan-phase0.md`.
- **1:** Home (the companion's grid), media, calendar, weather, shortcuts. Plan: `docs/plan-phase1.md`.
- **2:** Claude/Codex, alerts, timer, internet, sleep and night mode. Plan: `docs/plan-phase2.md`.
- **3:** Steam, printers, GitHub: pages and Home widgets.
- **4:** Kiosk, finishing touches. OLED burn-in (the phone is a Galaxy A52, Super AMOLED): shift the
  pixels now and then, dim static elements such as the navigation bar and the clock.

## Where we are

Phases 0 and 1 are done and verified on the phone by the user (branches `phase-0`, `phase-1`).
Phase 2, branch `phase-2`:

- [x] Plan approved and written down
- [x] Protocol: schemas and normalizers
- [x] Bridge: `pc_power` test, mock mode
- [x] Web: AI page and Home widget
- [x] Web: sound, alerts
- [x] Web: timer
- [x] Web: Internet view and Home widget
- [x] Web: dark layer
- [ ] README, docs/protocol.md
- [ ] Verified with the real companion
- [ ] Verified on the phone (by the user)

Update this list with every step.

Not verified yet: the split Media page with a real Plex or Jellyfin server; the binary frames `ARS1`
and `STM1` from a real companion (covered by unit tests only); how the phone looks while the PC is
offline (tests and a desktop browser only).

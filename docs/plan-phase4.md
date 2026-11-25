# Phase 4 plan (approved)

Goal: the phone can be left alone. The screen stays on, the page opens without the PC, nothing burns
in, updates arrive by themselves, and on the PC everything starts when the user signs in.

Upstream references are to `b78c505279a50f80cd40bfc86f0d9de9ac79437c`, as before. This phase is mostly
about the phone, where the board has nothing to copy.

## The obstacle: a secure context

Keeping the screen on (Screen Wake Lock) and opening without the PC (service worker) are only available
in a secure context. `http://192.168.x.x` isn't one. MDN says so for the wake lock; the same holds for
service workers. Four ways out:

| Way | Effort | Against it |
| --- | --- | --- |
| **A. Chrome's flag** `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, with the bridge's address | One setting on the phone, nothing to build | A developer flag that may disappear. Once per address. **Not verified on the phone.** |
| **B. HTTPS** on a second port, with a public certificate for a name in the user's own domain | Nothing to install on the phone and no warning there; set up once, then renewed by itself | Needs a domain and its DNS provider's API. See below. |
| **C. `adb reverse`** over USB: `http://localhost` is secure | Works today, no flag | Only with the cable in this PC and USB debugging on |
| **D. An app** (a kiosk browser such as Fully, or an own one) | A kiosk browser is ready-made; an own app needs the Android SDK | Fully's JavaScript control is in its paid version, 8.90 EUR per device. An own app is a project of its own. |

Decided: **A**, tried on the phone before anything else is built; if it doesn't work there, **B**. The page
itself is the same for all: it uses what it finds, and without a secure context everything works as it
does now.

Whichever way it is, the PC needs a fixed address, so a **DHCP reservation** in the router: the flag and
the saved link hold an IP address, and B's DNS record does too. The README says so.

Plain HTTP stays as unencrypted as it was; the flag only changes what the page may use.

### If A doesn't work: HTTPS with a name of the user's own

A certificate of our own, installed on the phone, is out: Android warns about it, and its key could pose as
other sites. Instead:

- A subdomain of the user's domain whose A record is the PC's address on the LAN, and a Let's Encrypt
  certificate for it through **DNS-01**: that only needs a DNS entry, so nothing on the PC has to be
  reachable from the Internet.
- An ACME client on the PC gets and renews it (Let's Encrypt goes from 90 days to 45 by February 2028, so
  it has to renew by itself). The client and the DNS provider's API token are the user's; the token should
  only be able to change that zone, better that one record. Neither the domain nor the token gets into the
  repository.
- The bridge: `HTTPS_CERT`, `HTTPS_KEY` and `HTTPS_PORT` in `.env`; a second server with the same handlers
  that takes a renewed certificate without a restart. The name is added to the allowed origins. Plain HTTP
  stays for the companion, on the same port as now. The firewall rule gets the second port.
- To know: names with certificates are public (certificate transparency), and the PC's private address is
  public in the DNS. Neither makes it reachable from outside.
- **DNS rebinding protection**: many routers drop DNS answers with private addresses, and then the phone
  can't find the name. The name has to be excepted in the router; or the phone uses another resolver
  (Android's *Private DNS*), which goes past the router's.
- It moves the page to another origin: the link with the token has to be opened once more, and what the
  phone saved starts over.

## Screen on, and really off

| Topic | Consequence |
| --- | --- |
| A wake lock is released when the page is hidden | Taken again when it is back. |
| With a black layer (`pc_sleep` or night `off`) on an OLED screen the pixels are off | The wake lock stays and the layer stays: an alert, the timer and the PC's waking can light it again. |
| Really off: giving the lock back would let Android's timeout turn the screen off, but a page can't turn it on again. Someone has to | Decided: no, and no setting for it. |
| Without a wake lock | As now: *Stay awake* in the developer options, while charging. |
| Kiosk | Android's own app pinning; no code. Described in the README. Starting after a reboot isn't possible for a page: one tap. |

## Opening without the PC

- A service worker keeps the built web app: files with a hash in their names from the cache, the page
  itself from the bridge if it answers within 2 seconds, else from the cache. It never touches
  `/client`, other methods or other origins, and never keeps an address with a token.
- A web app manifest (`display: fullscreen`, `orientation: landscape`, icons of our own, no one's logo),
  so that it can go on the home screen.
- What a page opened without the PC shows: clock, weather, timer, night mode, the last layout, and the
  **last calendar**. The calendar is new in `localStorage` (the board has it in RAM only). Everything else
  says that the PC is offline, as now.
- Of the calendar only what is in the `days` of its `events` message, from when that came, is saved. Events
  that are over are taken out of what is saved as well: when it is read, and while the page is open within
  a minute of their end. A page that is closed can't do that; they go when it is next opened.
- Without a secure context there is no service worker, and nothing changes.

## Burn-in

The phone is a Galaxy A52 with an OLED screen. Two measures, always on:

- **Pixel shift**: once a minute the bar and the page move by one step around a small square, at most
  4 CSS pixels from where they belong (about 10 of the screen's). Not the layers above them: the black
  one has to cover everything, and the clock moves already. Not while a finger is down.
- **Dimming what stands still**: after 2 minutes without a touch the navigation bar and Home's header
  go down to 45 %. A touch, an alert and the timer's end bring them back; the touch does what it does
  anyway.

*Time's up* stands still too, so it goes over to the dark layer's black after 10 minutes, with the card
dimmed. It doesn't go away.

## Updates and stumbles

- **A new build reaches the phone**: the snapshot says which build the bridge serves; a page with another
  one reloads once, when nobody has touched it for a minute, no timer is ending and there is **no active
  alert**. One more optional
  field, `build`, in `bridge.snapshot`.
- **No restart of the bridge after `pnpm build`**: it looks for files when asked, instead of listing them
  at startup.
- **An error on a page** shows a note with *Reload* instead of a blank screen, and reloads by itself
  after 30 seconds, also only without an active alert; not more than three times in 10 minutes.
- **Diagnostics**: a page under `/#info`, from the status icons: address, secure or not, wake lock,
  service worker, build, last error. It is also the tool to try way A with.

## The PC

`tools/autostart.ps1 install | remove | status`, run by the user: shortcuts in the Startup folder for the
bridge (hidden, with a log file) and, on request, for the companion through `run-companion.py`.
`deskhub-install` would bring the ASCII folding back. It only touches its own two shortcuts. If
`deskhub-install`'s is there too, it says so and doesn't add a second companion.

The Startup folder runs when the user signs in, not when Windows starts. The README explains that in the
same section as the firewall rule.

## The repository

- A GitHub Actions workflow: typecheck, tests, build on every push. It needs no secrets.
- `phase-0` to `phase-4` into `main` through one pull request, and the tag `v0.2.0`. Done only when the
  user says so.
- README: the set-up from start to finish on one path: DHCP reservation, firewall and autostart (one
  section), the flag, pinning, and the A52's **Protect battery** (charges to 85 % only), as the phone is
  always on the charger. Since One UI 6.1 it is called *Battery protection*, and its *Maximum* stops at
  80 %; which of them this phone has is for the user to see.

## Tests

- Web: the wake lock across hiding, refusal and its absence; the shift's path and bounds; idle and what
  ends it; the reload's conditions and its limit; the saved calendar, broken data included.
- Service worker: a unit test of the decision per request (cache, network, neither), with the token, `/client`
  and other origins.
- Bridge: `build`; new files served without a restart; the service worker's headers (`no-cache`, scope).
- The scripts: `status` on a folder of its own.

## Verification

1. **First, on the phone, by the user**: the diagnostics page with way A. Its result decides the rest.
2. `pnpm typecheck`, `pnpm test`, `pnpm build`; a desktop browser on `localhost` (secure): page opened
   with the bridge stopped, an update arriving, the error note; shift and dimming in screenshots, at all
   three sizes.
3. The phone, by the user: overnight with the screen on; opened with the PC off; an update.

## Commits

Branch `phase-4` from `phase-3`, conventional commits: docs (this plan), diagnostics, then after the
result from the phone: wake lock, service worker and manifest, burn-in, updates and errors, bridge,
autostart, CI, docs.

## Questions

Answered by the user:

1. **Way A** first. If it fails, HTTPS with a public certificate (above) instead of an own one.
2. **Really off**: no.
3. **The calendar on the phone**: yes; only the `days` range, and events that are over are removed. Titles
   and places are readable by whoever has the unlocked phone.
4. **Dimming**: 2 minutes and 45 %.
5. **`main`**: one pull request and CI at the end; merged when the user says so, after phase 3 was tried on
   the phone.

## Open from earlier phases

Steam on the user's own computer; phase 3 on the phone; the others in `CLAUDE.md`. They don't block this
phase, except that a merge into `main` should wait for them.

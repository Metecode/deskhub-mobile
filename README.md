# deskhub-mobile

Use an old Android phone as the screen for [Desk Hub](https://github.com/zacharyinserra/deskhub),
in place of its ESP32 display board.

> **Unofficial community client.** Not affiliated with or endorsed by the Desk Hub project. Please
> don't report problems with it there.

The Desk Hub companion on your Windows PC runs unmodified. A small bridge next to it behaves like
the board, and the phone shows the result in its browser:

```
Companion (Desk Hub, Python) --> Bridge (Node, on the PC) --> Web app (phone, fullscreen)
```

It has all of the board's pages: Home, PC Stats with the Internet, AI usage, Calendar, Weather, Media, 3D
printers, Timer, Games, GitHub and Shortcuts, in a layout of its own: a panel with the time, the weather and
the next event on every page, the page beside it, and named tabs. **The app, the launcher and its QR page are
in Turkish**; all texts of the app are in [apps/web/src/text.ts](apps/web/src/text.ts).

## Requirements

- Windows PC with the [Desk Hub companion](https://github.com/zacharyinserra/deskhub)
- Node 20.19 or newer (Node 21 and 22 before 22.12 won't work) and [pnpm](https://pnpm.io) 10
- A phone on the same network, with a current Chrome

## Set up

**The short way:** install the companion (step 2 below, without the `[hub]` part if you have no `.env` yet), then
double-click **deskhub-mobile.cmd**. The first time it makes `.env` with new tokens (or with the companion's),
installs, builds, asks for the companion's folder, the firewall and starting at sign-in, and shows a QR code to
scan with the phone. If the companion doesn't know the bridge yet, it says which two lines to change. After
that a double-click starts what isn't running, builds when the code is newer, and has a menu (in Turkish): QR code,
restart, stop, sign-in on or off. It never changes the companion's files. What is left by hand is Chrome's
flag on the phone, and what is in `.env` besides the tokens, such as the place for the weather.

The steps one by one:

### 1. The bridge

```sh
pnpm install
cp .env.example .env
pnpm build
```

Edit `.env`:

| Setting | |
| --- | --- |
| `HUB_TOKEN` | Shared secret with the companion. Make one up, don't keep `change-me`. |
| `CLIENT_TOKEN` | Required. Phones need it to see your data and to run your shortcuts. Use a different one. |
| `HUB_PORT` | 8765 unless you change it. |
| `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` | Where to show the weather for. Without them there is none. |
| `WEATHER_CITY`, `WEATHER_UNITS` | The name to show, and `metric` (default) or `imperial`. |
| `CLIENT_ORIGINS` | Only if you open the app under another name than the PC's own addresses, for example `http://hub.lan:8765`. |

`node -p "crypto.randomBytes(16).toString('hex')"` makes a good token.

### 2. The companion

Install it as [its README](https://github.com/zacharyinserra/deskhub#readme) says, but skip
everything about the board and its firmware. In `companion/config.toml` (copy
`config.example.toml` if you don't have one):

```toml
[hub]
host = "127.0.0.1:8765"
token = "the HUB_TOKEN from .env"
```

The companion connects to one hub at a time, so a real board gets nothing while this is set.

The rest of `config.toml` works as it does for the board: which pages there are and where the
navigation bar goes (`[pages]`), the Home grid (`[home]`), calendars, shortcut tiles.

**Optional: keep non-ASCII letters.** The board's fonts only cover ASCII, so the companion folds all
text to it, and some letters disappear: *Işıklı Yağmur* arrives as *Iskl Yagmur*. There's no setting
for that. [tools/run-companion.py](tools/run-companion.py) starts the same, unmodified companion with
that one function replaced while it runs. Start it with the companion's own Python, from its folder,
in place of `uv run python -m deskhub`:

```sh
uv run python ../../deskhub-mobile/tools/run-companion.py
```

It takes the same options. The tray icon's *Restart*, and the shortcut that `deskhub-install` makes,
start the companion the normal way and bring the folding back.

With only Claude Code's VS Code extension there is no `claude` on the PATH, which the companion's *live limits*
(`live_limits = true` under `[claude]`) need to have an expired sign-in renewed. `run-companion.py` lets it
find the extension's.

### 3. The PC: a fixed address, the firewall, starting by itself

**A fixed address.** The link, what the phone has saved and Chrome's flag below all hold the PC's IP
address. Give the PC a DHCP reservation in your router (often under *LAN* or *DHCP*, by the PC's MAC
address), so that it never changes. If it does change, open the new link and set the flag again; the
phone starts over with what it had saved.

**The firewall.** The phone must reach port 8765 on the PC. In PowerShell as administrator:

```powershell
New-NetFirewallRule -DisplayName "deskhub-mobile" -Direction Inbound -Protocol TCP `
  -LocalPort 8765 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

This only opens it on networks Windows treats as *Private* (Settings > Network & internet > your
network). If Windows asks about Node.js when the bridge first starts, allowing private networks
does the same job. Started by itself and hidden, it may not get to ask, so make the rule first. To undo
it: `Remove-NetFirewallRule -DisplayName "deskhub-mobile"`.

**Starting by itself.** [tools/autostart.ps1](tools/autostart.ps1) puts shortcuts in your Startup folder,
without administrator rights. The second line also starts the companion, through
`tools/run-companion.py` (see above); give it the folder with the companion's `config.toml` and `.venv`:

```powershell
powershell -ExecutionPolicy Bypass -File tools\autostart.ps1 install
powershell -ExecutionPolicy Bypass -File tools\autostart.ps1 install -Companion ..\deskhub\companion
```

`status` and `remove` in place of `install` do what they say. **The Startup folder runs when you sign in**, not
when Windows starts: after a restart the phone shows the PC as offline until somebody has signed in.
Windows also waits a little with it after that. The bridge runs hidden and writes
`%LOCALAPPDATA%\deskhub-mobile\bridge.log`, without the links, as they have the token in them. If you
used `deskhub-install`, remove that first (`uv run deskhub-install --remove`).

### 4. Run it

Once by hand, for the links:

```sh
pnpm start
```

Then start the companion. The order doesn't matter.

### 5. The phone

The bridge prints links like `http://192.168.1.20:8765/?token=...`. Open one on the phone. The
token is saved in the browser and removed from the address, so you only need the link once.
Tap the screen to go fullscreen.

**Chrome's flag.** Browsers only let a page keep the screen on, and open without its server, in a *secure
context*: HTTPS, or an address you declare as secure. On the phone, in Chrome:

1. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
2. Enter the address without the token, for example `http://192.168.1.20:8765`.
3. Choose *Enabled* and tap *Relaunch*.

Then touch the connection's icon in the panel (or open `/#info`): the diagnostics (*Tanılama*) should say
*Güvenli bağlam: var*, *Ekranı açık tutma: ... açık* and *Çevrimdışı kopya: etkin*. The flag only changes what
this one page may use; the traffic stays as unencrypted as before. It is meant for developers and may
disappear from Chrome one day. Without it everything else works; then turn on *Stay awake* (while
charging) in Android's developer options.

**On the home screen.** In Chrome's menu, *Add to home screen*. Opened from there it starts fullscreen,
where Chrome allows that for an address declared as secure.

**Pinning.** To keep the phone in the app, turn on Android's app pinning (Settings > Security and privacy >
More security settings > *Pin app* on a Galaxy; elsewhere search the settings for "pin"), open the app and
pin it in the overview of recent apps. After a restart of the phone the app has to be opened again: one
tap.

**The battery.** The phone is always on the charger, so limit the charge. On a Galaxy A52: Settings > Battery
and device care > Battery > More battery settings > *Protect battery*, which stops at 85 %. With One UI
6.1 and later it is Settings > Battery > *Battery protection*; its *Maximum* stops at 80 %. Names differ a
little between versions.

**Over USB.** With USB debugging on, `adb reverse tcp:8765 tcp:8765` makes the bridge available on
the phone as `http://localhost:8765`, without Wi-Fi or a firewall rule. That is a secure context without
the flag.

## What to know

Claude Code's alerts ("needs permission", "waiting for you") and its limits need a hook and a status
line in Claude Code's settings, which the companion's `install_claude.py` adds; see the Desk Hub
README. Without them the AI page shows tokens only.

A shortcut with the icon `power_settings_new` (for sleep or shutdown) takes two touches.

Games start with one tap; after that all of them are locked for 5 seconds on that phone. GitHub needs a
token (`deskhub-setup github`), printers are added with `deskhub-printers`; see the Desk Hub README.
The dock has the first five pages in the order of `[pages] enabled`, the rest are under *Tümü*. *Tümü* >
*Sekmeler* changes the order on that phone: touch a tab, then the one to swap it with. `nav` says on
which side the panel is; with `bottom` it is a line across the top. Home leaves out the weather and the events,
as the panel has both, and the widgets next to them grow.

The timer's end and new alerts come with a beep and a vibration. Browsers only allow both after a
touch on the page, so after a reload there's only the picture until you touch it.

When the PC's display goes to sleep, or at night, the screen goes dark (`pc_sleep` and `night` under
`[display]` in `config.toml`, as for the board); a touch wakes it for a minute. A web page can't turn
the screen off and on again, so it's black: on an OLED phone those pixels are off, on an LCD there is a
faint glow, and the clock may look better. An alert or the timer lights it.

**While the PC is off**, the clock, the weather, the timer, night mode and the last calendar work, and the
page opens without it, if the flag is set. The phone keeps the last calendar for that: only the days the
companion looks ahead (`days` under `[calendar]`), and events that are over are removed, though not
before the page is next open. Whoever has the unlocked phone can read it.

**Against burn-in**, everything moves by a few pixels once a minute, and after 2 minutes without a touch
the panel and the dock are dimmed. The timer's end goes dark after 10 minutes.

**The connection's icon** goes by how long the bridge's answers take, as a page can't read the Wi-Fi's signal
strength: three green arcs, two orange ones, one red one, crossed out without a connection. A crossed-out PC
next to it: the bridge is there, the companion isn't.

**Updates.** After `pnpm build` the running bridge serves the new build, and phones load it by
themselves: once nobody has touched them for a minute, and neither while there is an alert nor while a timer
runs or has ended. Such a reload leaves fullscreen until the next tap, unless the app was opened from
the home screen. Changes to the bridge itself need a restart of it. If a page fails, a note shows instead,
and it reloads after 30 seconds, under the same conditions and three times in 10 minutes at most.

## Security

Traffic isn't encrypted, so use a network you trust. Without `CLIENT_TOKEN` a device can't see
anything or send commands, and only the commands the board itself can send are passed on.
Other websites can't connect through your browser: only the PC's own addresses, on the bridge's
port and Vite's 5173, and `CLIENT_ORIGINS` may.

The weather comes from [Open-Meteo](https://open-meteo.com), straight to the phone. Open-Meteo sees the
phone's address and the coordinates in `.env` (two decimals are plenty), nothing else. Without
coordinates nothing is fetched.

## What's missing

- **CPU temperature**: the companion doesn't send it. It will show if a later version does.
- **GPU**: the companion reads NVIDIA cards only.
- **Sharper covers**: the companion sends them at 280 x 280.
- **Codex's logo**: there's a neutral icon in its colour. Claude's is there, see [NOTICE](NOTICE).
- **Turning the screen off**: see above.
- **Sharper game covers**: 96 x 144, as the companion sends them.
- **Plex and Jellyfin**: the split Media page is there, but hasn't been tried with a real server.

## Development

```sh
pnpm dev        # bridge with made-up data, and Vite on port 5173
pnpm test
pnpm typecheck
```

`pnpm dev` doesn't need the companion, only `CLIENT_TOKEN`. The made-up PC goes offline for 10 seconds now
and then, on purpose. To open it on the phone, allow port 5173 in the firewall too.

[tools/fake-moonraker.mjs](tools/fake-moonraker.mjs) stands in for a 3D printer; how to point the companion
at it is at its top.

[tools/launch.ps1](tools/launch.ps1) is what `deskhub-mobile.cmd` runs.

- [docs/protocol.md](docs/protocol.md): the messages
- [docs/plan-phase0.md](docs/plan-phase0.md), [docs/plan-phase1.md](docs/plan-phase1.md),
  [docs/plan-phase2.md](docs/plan-phase2.md), [docs/plan-phase3.md](docs/plan-phase3.md),
  [docs/plan-phase4.md](docs/plan-phase4.md), [docs/plan-phase5.md](docs/plan-phase5.md): the plans
- [CLAUDE.md](CLAUDE.md): project context, rules and phases

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for Desk Hub, the fonts and the weather data.

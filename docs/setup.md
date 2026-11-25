# Setting up

**You need:**

- Windows PC with the [Desk Hub companion](https://github.com/zacharyinserra/deskhub)
- Node 20.19 or newer (Node 21 and 22 before 22.12 won't work) and [pnpm](https://pnpm.io) 10
- A phone on the same network, with a current Chrome

**The short way:** install the companion (step 2 below, without the `[hub]` part if you have no `.env` yet), then
double-click **deskhub-mobile.cmd**. The first time it makes `.env` with new tokens (or with the companion's),
installs, builds, asks for the companion's folder, the firewall and starting at sign-in, and shows a QR code to
scan with the phone. If the companion doesn't know the bridge yet, it says which two lines to change. After
that a double-click starts what isn't running, builds when the code is newer, and has a menu (in Turkish): QR code,
restart, stop, sign-in on or off. It never changes the companion's files. What is left by hand is Chrome's
flag on the phone, and what is in `.env` besides the tokens, such as the place for the weather.

The steps one by one:

## 1. The bridge

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

## 2. The companion

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
for that. [tools/run-companion.py](../tools/run-companion.py) starts the same, unmodified companion with
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

## 3. The PC: a fixed address, the firewall, starting by itself

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
does the same job. `deskhub-mobile.cmd` offers to add the rule, but not when there are rules for Node.js
already; if those are for *Public* networks only, add it by hand. Should Windows ask about Node.js later, for example
with `pnpm dev`, allow it on *Private* networks: until you answer, and if you refuse, it blocks Node.js on all
ports, and the phone loses the bridge in spite of the rule above. Started by itself and hidden, it may not get to
ask, so make the rule first. To undo
it: `Remove-NetFirewallRule -DisplayName "deskhub-mobile"`.

**Starting by itself.** [tools/autostart.ps1](../tools/autostart.ps1) puts shortcuts in your Startup folder,
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

## 4. Run it

Once by hand, for the links:

```sh
pnpm start
```

Then start the companion. The order doesn't matter.

## 5. The phone

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

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

There are Home, PC Stats with the Internet, AI usage, Calendar, Weather, Media, Timer and Shortcuts.
The other pages (games, printers, GitHub) follow; until then their Home widgets are placeholders.

## Requirements

- Windows PC with the [Desk Hub companion](https://github.com/zacharyinserra/deskhub)
- Node 20.19 or newer (Node 21 and 22 before 22.12 won't work) and [pnpm](https://pnpm.io) 10
- A phone on the same network, with a current Chrome

## Set up

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

### 3. Windows Firewall

The phone must reach port 8765 on the PC. In PowerShell as administrator:

```powershell
New-NetFirewallRule -DisplayName "deskhub-mobile" -Direction Inbound -Protocol TCP `
  -LocalPort 8765 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

This only opens it on networks Windows treats as *Private* (Settings > Network & internet > your
network). If Windows asks about Node.js when the bridge first starts, allowing private networks
does the same job. To undo it: `Remove-NetFirewallRule -DisplayName "deskhub-mobile"`.

### 4. Run it

```sh
pnpm start
```

Then start the companion. The order doesn't matter.

### 5. The phone

The bridge prints links like `http://192.168.1.20:8765/?token=...`. Open one on the phone. The
token is saved in the browser and removed from the address, so you only need the link once.
Tap the screen to go fullscreen.

Claude Code's alerts ("needs permission", "waiting for you") and its limits need a hook and a status
line in Claude Code's settings, which the companion's `install_claude.py` adds; see the Desk Hub
README. Without them the AI page shows tokens only.

The timer's end and new alerts come with a beep and a vibration. Browsers only allow both after a
touch on the page, so after a reload there's only the picture until you touch it.

When the PC's display goes to sleep, or at night, the screen goes dark (`pc_sleep` and `night` under
`[display]` in `config.toml`, as for the board); a touch wakes it for a minute. A web page can't turn
the screen off, so it's black: dark on an OLED phone, a faint glow on an LCD, where the clock may look
better.

While the PC is off, the clock, the weather and the last calendar stay, as long as the page is open.
Opening it needs the bridge.

**Keeping the screen on.** Browsers only let a page keep the screen on over HTTPS or on
`localhost`, and the app doesn't do it yet. Until it does, turn on *Stay awake* (while charging)
in Android's developer options.

**Over USB.** With USB debugging on, `adb reverse tcp:8765 tcp:8765` makes the bridge available on
the phone as `http://localhost:8765`, without Wi-Fi or a firewall rule.

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
- **The agents' logos**: they are trademarks, so there's an icon in their colour.
- **Turning the screen off**: see above.
- **Plex and Jellyfin**: the split Media page is there, but hasn't been tried with a real server.

## Development

```sh
pnpm dev        # bridge with made-up data, and Vite on port 5173
pnpm test
pnpm typecheck
```

`pnpm dev` doesn't need the companion, only `CLIENT_TOKEN`. After `pnpm build`, restart a running
bridge: it lists the web app's files when it starts. The made-up PC goes offline for 10
seconds now and then, on purpose. To open it on the phone, allow port 5173 in the firewall too.

- [docs/protocol.md](docs/protocol.md): the messages
- [docs/plan-phase0.md](docs/plan-phase0.md), [docs/plan-phase1.md](docs/plan-phase1.md),
  [docs/plan-phase2.md](docs/plan-phase2.md): the plans
- [CLAUDE.md](CLAUDE.md): project context, rules and phases

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for Desk Hub, the fonts and the weather data.

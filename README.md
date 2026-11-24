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

Early days: so far there's one page, PC Stats. The other pages follow.

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

## What's missing

- **CPU temperature**: the companion doesn't send it. It will show if a later version does.
- **GPU**: the companion reads NVIDIA cards only.

## Development

```sh
pnpm dev        # bridge with made-up data, and Vite on port 5173
pnpm test
pnpm typecheck
```

`pnpm dev` doesn't need the companion, only `CLIENT_TOKEN`. The made-up PC goes offline for 10
seconds now and then, on purpose. To open it on the phone, allow port 5173 in the firewall too.

- [docs/protocol.md](docs/protocol.md): the messages
- [docs/plan-phase0.md](docs/plan-phase0.md): the plan for this phase
- [CLAUDE.md](CLAUDE.md): project context, rules and phases

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for Desk Hub and the Inter font.

# What to know

Claude Code's alerts ("needs permission", "waiting for you") and its limits need a hook and a status
line in Claude Code's settings, which the companion's `install_claude.py` adds; see the Desk Hub
README. `live_limits = true` under `[claude]` in `config.toml` brings the limits without the status line.
Without either the AI page shows tokens only.

A shortcut with the icon `power_settings_new` (for sleep or shutdown) takes two touches.

Games start with one tap; after that all of them are locked for 5 seconds on that phone. GitHub needs a
token (`deskhub-setup github`), printers are added with `deskhub-printers`; see the Desk Hub README.
The dock has the first five pages in the order of `[pages] enabled`, the rest are under *Tümü*. *Tümü* >
*Sekmeler* changes the order on that phone: touch a tab, then the one to swap it with.
Swiping sideways on a page goes to the next tab of the dock. `nav` says on
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

## What's missing

- **CPU temperature**: the companion doesn't send it. It will show if a later version does.
- **GPU**: the companion reads NVIDIA cards only.
- **Sharper covers**: the companion sends them at 280 x 280.
- **Codex's logo**: there's a neutral icon in its colour. Claude's is there, see [NOTICE](../NOTICE).
- **Turning the screen off**: see above.
- **Sharper game covers**: 96 x 144, as the companion sends them.
- **Plex and Jellyfin**: the split Media page is there, but hasn't been tried with a real server.

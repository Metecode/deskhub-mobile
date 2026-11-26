# Security

Traffic isn't encrypted, so use a network you trust. Without `CLIENT_TOKEN` a device can't see
anything or send commands, and only the commands the board itself can send are passed on.
Other websites can't connect through your browser: only the PC's own addresses, on the bridge's
port and Vite's 5173, and `CLIENT_ORIGINS` may. Nor can they frame the app. Only a program on the PC
itself can connect as the companion.

Nothing slows down guessing, so `CLIENT_TOKEN` should be as long as the command in the [setup guide](setup.md#1-the-bridge) makes it.

`deskhub-mobile.cmd` closes `.env` to the PC's other accounts each time it starts. Without it, outside your
user folder every account can read it; to do the same by hand:
`icacls .env /inheritance:r /grant:r "%USERNAME%:F"` (in cmd). They can still change the code there, which
runs as you, so on a PC that you share keep all of it in your user folder.

Use a network that Windows treats as *Private*. If Windows made rules for Node.js, they may open every port on
*Public* networks too: look for *Node.js JavaScript Runtime* in the firewall's inbound rules, and prefer the
[rule for one port](setup.md#3-the-pc-a-fixed-address-the-firewall-starting-by-itself).

**The morning bulletin.** Codex runs on your ChatGPT plan, never with an API key: with `OPENAI_API_KEY` set, or
Codex signed in with a key, the bridge won't run it. Codex reads web pages, which could try to steer it, so it
may only search: `--disable shell_tool` (no commands), `--disable apps` (no ChatGPT connectors such as Drive or
Gmail), a read-only sandbox, `--ephemeral`, in an empty folder; the bridge checks with `codex features list` before
every run that both are off. The only private data it sees is what the bridge puts in the prompt: the sheet's
tabs in `SHEETS_TABS`, not `Belgeler` (account numbers, links to statements) nor cash or income, and it is told
that this is data, not instructions. The service account may only read, and only what is shared with it. The
prompt, `reminders.json` and the key file are in `.gitignore`; bulletins and measurements stay in
`%LOCALAPPDATA%\deskhub-mobile\data`, and the log has only Codex's exit code and time. On the phone the bulletin is
shown without raw HTML, links only if `http(s)`. Keep the sheet *Restricted*: "anyone with the link" makes it
public to whoever has the link.

The weather comes from [Open-Meteo](https://open-meteo.com), straight to the phone. Open-Meteo sees the
phone's address and the coordinates in `.env` (two decimals are plenty), nothing else. Without
coordinates nothing is fetched.

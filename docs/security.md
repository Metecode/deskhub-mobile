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

The weather comes from [Open-Meteo](https://open-meteo.com), straight to the phone. Open-Meteo sees the
phone's address and the coordinates in `.env` (two decimals are plenty), nothing else. Without
coordinates nothing is fetched.

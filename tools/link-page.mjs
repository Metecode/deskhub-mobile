// Writes a page with a QR code to open the app on a phone. For launch.ps1:
//
//   node tools/link-page.mjs <out.html> <port> [address]
//
// The link has the token in it, which comes from CLIENT_TOKEN in the environment or .env. Nothing
// leaves this PC: the code is drawn here. launch.ps1 deletes the page again.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderSVG } from 'uqr';

const [out, port, address] = process.argv.slice(2);
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // The environment may have it.
}
const token = process.env.CLIENT_TOKEN?.trim();
if (!out || !port || !address || !token) {
  console.error('usage: node tools/link-page.mjs <out.html> <port> <address>, with CLIENT_TOKEN set');
  process.exit(1);
}

const escape = (text) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const origin = `http://${address}:${port}`;
const link = `${origin}/?token=${encodeURIComponent(token)}`;
const flag = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';

writeFileSync(
  out,
  `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<title>deskhub-mobile: connect a phone</title>
<style>
  body { max-width: 900px; margin: 40px auto; padding: 0 20px; background: #0d0e11; color: #f3f4f6; font: 17px/1.5 system-ui, sans-serif; }
  main { display: flex; flex-wrap: wrap; gap: 40px; align-items: flex-start; }
  figure { margin: 0; padding: 12px; border-radius: 16px; background: #fff; }
  svg { display: block; width: 300px; height: 300px; }
  ol { flex: 1; min-width: 300px; margin: 0; padding-left: 22px; }
  li { margin-bottom: 12px; }
  code { padding: 1px 6px; border-radius: 6px; background: #262a32; font-size: 15px; overflow-wrap: anywhere; user-select: all; }
  .note { color: #9aa0aa; }
</style>
<h1>Connect a phone</h1>
<main>
  <figure>${renderSVG(link, { border: 2 })}</figure>
  <ol>
    <li>On the phone, on the same network as this PC, scan the code and open it in <b>Chrome</b>.</li>
    <li>So that the screen stays on and the app opens without the PC, open <code>${flag}</code> in Chrome, enter
      <code>${escape(origin)}</code>, choose <b>Enabled</b> and tap <b>Relaunch</b>. Once per phone.</li>
    <li>In Chrome's menu, choose <b>Add to home screen</b>.</li>
  </ol>
</main>
<p class="note">The code has your token in it: whoever scans it can see your data and run your shortcuts. This page is
deleted when you close the window it came from. Give this PC a DHCP reservation in your router, so that
${escape(address)} stays its address.</p>
</html>
`,
);

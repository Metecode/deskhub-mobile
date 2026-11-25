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
<html lang="tr">
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<title>deskhub-mobile: telefonu bağla</title>
<style>
  body { max-width: 900px; margin: 40px auto; padding: 0 20px; background: #000; color: #f3f4f6; font: 17px/1.5 system-ui, sans-serif; }
  main { display: flex; flex-wrap: wrap; gap: 40px; align-items: flex-start; }
  figure { margin: 0; padding: 12px; border-radius: 16px; background: #fff; }
  svg { display: block; width: 300px; height: 300px; }
  ol { flex: 1; min-width: 300px; margin: 0; padding-left: 22px; }
  li { margin-bottom: 12px; }
  code { padding: 1px 6px; border-radius: 6px; background: #262a32; font-size: 15px; overflow-wrap: anywhere; user-select: all; }
  .note { color: #9aa0aa; }
</style>
<h1>Telefonu bağla</h1>
<main>
  <figure>${renderSVG(link, { border: 2 })}</figure>
  <ol>
    <li>Bu PC ile aynı ağdaki telefonda kodu okut ve <b>Chrome</b> ile aç.</li>
    <li>Ekran açık kalsın ve uygulama PC olmadan açılsın diye Chrome’da <code>${flag}</code> adresini aç,
      <code>${escape(origin)}</code> yaz, <b>Enabled</b> seç ve <b>Relaunch</b>’a bas. Her telefonda bir kez.</li>
    <li>Chrome menüsünden <b>Ana ekrana ekle</b>’yi seç.</li>
  </ol>
</main>
<p class="note">Kodda bağlantı anahtarın var: okutan kişi verilerini görebilir ve kısayollarını çalıştırabilir. Bu sayfa,
açıldığı pencere Enter ile kapatılınca silinir. Modemde bu PC için DHCP rezervasyonu yap ki adresi
${escape(address)} olarak kalsın.</p>
</html>
`,
);

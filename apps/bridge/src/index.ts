import { fileURLToPath } from 'node:url';
import { TOKEN_PARAM } from '@deskhub-mobile/protocol';
import { BulletinService } from './bulletinService.js';
import type { BridgeServices } from './clientEndpoint.js';
import { readConfig, type Config } from './config.js';
import { consoleLogger as log } from './log.js';
import { startMockCompanion } from './mockCompanion.js';
import { DEV_PORT, lanAddresses } from './origins.js';
import { portfolioMaker } from './portfolio.js';
import { readGoogleSheet } from './sheetsClient.js';
import { Bridge } from './server.js';

// Both src/ and dist/ are three levels below the repository root.
const fromRoot = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

function loadConfig(): Config {
  try {
    process.loadEnvFile(fromRoot('.env'));
  } catch {
    // No .env: the environment may still have everything.
  }
  return readConfig(process.env, process.argv.includes('--mock'), fromRoot('.'));
}

/** The bridge's own features. Mock mode has made-up ones and never runs Codex. */
function services(config: Config, broadcast: (text: string) => void): { services: BridgeServices; start(): Promise<void> } {
  const bulletin = new BulletinService({
    ...config.bulletin,
    dataDir: config.dataDir,
    env: process.env,
    publish: (message) => broadcast(JSON.stringify(message)),
    log,
    portfolio: portfolioMaker,
    readSheet: config.sheets ? () => readGoogleSheet(config.sheets!) : undefined,
  });
  return {
    services: {
      messages: () => [JSON.stringify(bulletin.message)],
      opened: () => bulletin.opened(),
      command: (command) => {
        if (command.type === 'bridge.bulletin.run') void bulletin.runNow();
      },
    },
    start: () => bulletin.start(),
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  for (const warning of config.warnings) log.warn(warning);

  let send: (text: string) => void = () => {};
  const own = config.mock ? null : services(config, (text) => send(text));
  const bridge = new Bridge({ ...config, webRoot: fromRoot('apps/web/dist'), log, services: own?.services });
  send = (text) => bridge.clients.broadcast(text);
  await own?.start();
  // All interfaces: the companion comes from this PC, phones from the network.
  await bridge.listen(config.port, '0.0.0.0');

  log.info(`listening on port ${config.port}${config.mock ? ', mock mode' : ''}`);
  // In mock mode the web app comes from the Vite dev server.
  const webPort = config.mock ? DEV_PORT : config.port;
  // They have the token in them (tools/start-bridge.ps1 writes a log file).
  const links = process.argv.includes('--no-links') ? [] : ['localhost', ...lanAddresses()];
  if (links.length) log.info('open one of these (localhost is this PC, or a phone with adb reverse):');
  for (const address of links)
    log.info(`  http://${address}:${webPort}/?${TOKEN_PARAM}=${encodeURIComponent(config.clientToken)}`);

  if (config.mock) {
    startMockCompanion({
      url: `ws://127.0.0.1:${config.port}/ws`,
      token: config.hubToken,
      companionConnected: () => bridge.companion.connected,
      log,
    });
  }
}

main().catch((e: NodeJS.ErrnoException) => {
  log.warn(e.code === 'EADDRINUSE' ? 'The port is already in use. Is the bridge already running?' : e.message);
  process.exit(1);
});

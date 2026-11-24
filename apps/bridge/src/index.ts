import { fileURLToPath } from 'node:url';
import { TOKEN_PARAM } from '@deskhub-mobile/protocol';
import { readConfig, type Config } from './config.js';
import { consoleLogger as log } from './log.js';
import { lanAddresses } from './origins.js';
import { Bridge } from './server.js';

// Both src/ and dist/ are three levels below the repository root.
const fromRoot = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

function loadConfig(): Config {
  try {
    process.loadEnvFile(fromRoot('.env'));
  } catch {
    // No .env: the environment may still have everything.
  }
  return readConfig(process.env, process.argv.includes('--mock'));
}

async function main(): Promise<void> {
  const config = loadConfig();
  for (const warning of config.warnings) log.warn(warning);

  const bridge = new Bridge({ ...config, webRoot: fromRoot('apps/web/dist'), log });
  // All interfaces: the companion comes from this PC, phones from the network.
  await bridge.listen(config.port, '0.0.0.0');

  log.info(`listening on port ${config.port}${config.mock ? ', mock mode' : ''}`);
  log.info('open one of these on the phone:');
  for (const address of lanAddresses())
    log.info(`  http://${address}:${config.port}/?${TOKEN_PARAM}=${encodeURIComponent(config.clientToken)}`);
}

main().catch((e: NodeJS.ErrnoException) => {
  log.warn(e.code === 'EADDRINUSE' ? 'The port is already in use. Is the bridge already running?' : e.message);
  process.exit(1);
});

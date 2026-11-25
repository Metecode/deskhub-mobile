import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Writes build.json, after everything else: which build this is and the files the service worker
 * keeps. The bridge serves a new build once this file is there.
 */
function buildJson(build: string): Plugin {
  let outDir = '';
  return {
    name: 'build-json',
    apply: 'build',
    configResolved: (config) => {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle: () => {
      const files = readdirSync(join(outDir, 'assets'))
        // Browsers that have service workers take .woff2 and leave .woff alone.
        .filter((name) => /\.(js|css|woff2)$/.test(name))
        .map((name) => `/assets/${name}`);
      writeFileSync(join(outDir, 'build.json'), JSON.stringify({ build, files }));
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '../..', 'HUB_');
  const build = command === 'build' ? new Date().toISOString() : 'dev';
  return {
    plugins: [react(), buildJson(build)],
    define: { __BUILD__: JSON.stringify(build) },
    build: {
      rolldownOptions: {
        input: { index: 'index.html', sw: 'src/sw/sw.ts' },
        output: {
          // The service worker's address must stay the same, and at the top to cover everything.
          entryFileNames: ({ name }) => (name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
    server: {
      // All interfaces, so a phone can open it.
      host: true,
      // The bridge only allows origins on this port (apps/bridge/src/origins.ts).
      port: 5173,
      strictPort: true,
      proxy: {
        '/client': { target: `ws://127.0.0.1:${env.HUB_PORT || 8765}`, ws: true },
      },
    },
  };
});

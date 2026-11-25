import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '../..', 'HUB_');
  return {
    plugins: [react()],
    define: {
      __BUILD__: JSON.stringify(command === 'build' ? new Date().toISOString() : 'dev'),
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

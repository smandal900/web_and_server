import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `npm run dev` proxies the API (and the websocket) to the Express server.
// `npm run build` writes to ./build, the folder the server serves by default.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', ws: true, changeOrigin: true } },
  },
  build: { outDir: 'build', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
});

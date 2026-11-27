import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The phone app. It lives at /app/ on the same server, so it shares the login with the web app, and it imports the web
// app's API calls, sign-in, upload and grouping code from ../web/src (alias @web) instead of repeating them.
export default defineConfig({
  base: '/app/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@web': fileURLToPath(new URL('../web/src', import.meta.url)) },
    // the shared files must use this project's copy of these, not web/node_modules
    dedupe: ['react', 'react-dom', 'react-router', '@tanstack/react-query', '@mdi/js', '@noble/hashes', 'thumbhash'],
  },
  server: { port: 5174, fs: { allow: ['..'] }, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
  build: { outDir: 'build', emptyOutDir: true },
});

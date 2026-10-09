import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: false, port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
});

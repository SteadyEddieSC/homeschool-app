import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    sourcemap: true,
    target: 'es2022'
  },
  server: {
    host: '127.0.0.1',
    port: 4173
  }
});

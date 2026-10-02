import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The app reuses the web game screens (apps/web/src/game) and swaps in native device features.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@/lib/native', replacement: path.resolve(import.meta.dirname, 'src/native.ts') },
      { find: '@', replacement: path.resolve(import.meta.dirname, '../web/src') },
    ],
  },
  // Bundled into the app, not downloaded: one chunk is fine.
  build: { chunkSizeWarningLimit: 1000 },
  server: { port: 5174 },
});

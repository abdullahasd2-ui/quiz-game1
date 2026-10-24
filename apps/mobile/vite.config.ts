import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import pkg from './package.json';

/**
 * First native build (iOS CFBundleVersion / Android versionCode) that has every native plugin this
 * bundle calls. Bump it with the build numbers when adding a plugin: older installs then keep the
 * bundle they have instead of getting one they can't run.
 */
const MIN_NATIVE_BUILD = 2;

/**
 * Writes dist/ota.json for live updates: the bundle's version (a hash of its files, so an unchanged
 * app keeps its version across deploys) and MIN_NATIVE_BUILD. Read by capacitor.config.ts for the
 * built-in bundle and by the server for the one it hands out (apps/server/src/api/public/app-update.ts).
 */
function otaManifest(): Plugin {
  let outDir = '';
  return {
    name: 'ota-manifest',
    apply: 'build',
    configResolved: (config) => void (outDir = path.resolve(config.root, config.build.outDir)),
    closeBundle() {
      const hash = createHash('sha256');
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(outDir, path.join(entry.parentPath, entry.name)))
        .sort();
      for (const file of files) hash.update(`${file}\0`).update(readFileSync(path.join(outDir, file)));
      const version = `${pkg.version}-${hash.digest('hex').slice(0, 12)}`;
      writeFileSync(path.join(outDir, 'ota.json'), JSON.stringify({ version, minNativeBuild: MIN_NATIVE_BUILD }));
    },
  };
}

// The app reuses the web game screens (apps/web/src/game) and swaps in native device features.
export default defineConfig(({ command, mode }) => {
  // Without it the app calls its own local origin instead of the game server, and an OTA would ship that to every phone.
  if (command === 'build' && !loadEnv(mode, import.meta.dirname, 'VITE_').VITE_SERVER_URL) {
    throw new Error('VITE_SERVER_URL is not set (apps/mobile/.env)');
  }
  return {
    plugins: [react(), tailwindcss(), otaManifest()],
    resolve: {
      alias: [
        { find: '@/lib/native', replacement: path.resolve(import.meta.dirname, 'src/native.ts') },
        { find: '@', replacement: path.resolve(import.meta.dirname, '../web/src') },
      ],
    },
    // Loaded from the device (built in, or one OTA zip), never per page: one chunk is fine.
    build: { chunkSizeWarningLimit: 1000 },
    server: { port: 5174 },
  };
});

import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

/** Version of the bundle `cap sync` copies into the app, written by the build (see vite.config.ts). */
function builtinVersion(): string | undefined {
  try {
    return JSON.parse(readFileSync('dist/ota.json', 'utf8')).version;
  } catch {
    return undefined;
  }
}

const config: CapacitorConfig = {
  appId: 'com.jawabbadel.app',
  appName: 'جاوب أو بادل',
  webDir: 'dist',
  backgroundColor: '#07071a',
  ios: { contentInset: 'never', scheme: 'App' },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#07071a', showSpinner: false },
    // Live updates from our own server (apps/server/src/api/public/app-update.ts). The empty URLs keep
    // the plugin from reporting to Capgo's cloud. A new bundle downloads in the background and
    // replaces the current one the next time the app goes to the background.
    CapacitorUpdater: {
      updateUrl: 'https://jawabbadel.com/api/app/update',
      statsUrl: '',
      channelUrl: '',
      // Reported for the built-in bundle, so a fresh install isn't sent the same bundle again.
      version: builtinVersion(),
    },
  },
};

export default config;

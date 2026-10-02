import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jawabbadel.app',
  appName: 'جاوب أو بادل',
  webDir: 'dist',
  backgroundColor: '#07071a',
  ios: { contentInset: 'never', scheme: 'App' },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#07071a', showSpinner: false },
  },
};

export default config;

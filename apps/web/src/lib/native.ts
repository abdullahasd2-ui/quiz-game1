/**
 * Device features. The web build uses these no-ops; the mobile app swaps this module
 * for its Capacitor version (see apps/mobile/vite.config.ts).
 */
import type { Platform } from '@quiz/shared';

/** Reported to the server for usage stats. */
export const platform: Platform = 'web';

/** Opens the system share sheet; false when unavailable, so the caller falls back to copying. */
export async function shareInvite(_url: string, _text: string): Promise<boolean> {
  return false;
}

export function haptic(_kind: 'success' | 'error' | 'tap') {}

import { Capacitor } from '@capacitor/core';
import type { Platform } from '@quiz/shared';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

/** Capacitor version of apps/web/src/lib/native.ts. */
export const platform = Capacitor.getPlatform() as Platform;

export async function shareInvite(url: string, text: string): Promise<boolean> {
  try {
    await Share.share({ title: 'جاوب أو بادل', text, url, dialogTitle: 'ادعُ صديقك' });
  } catch {
    // Dismissing the sheet also rejects; either way don't fall back to copying.
  }
  return true;
}

export function haptic(kind: 'success' | 'error' | 'tap') {
  const run =
    kind === 'tap'
      ? Haptics.impact({ style: ImpactStyle.Light })
      : Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error });
  run.catch(() => {});
}

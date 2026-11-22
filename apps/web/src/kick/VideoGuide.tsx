import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { serverUrl } from '@/lib/server';

/** The stream guide video (the real site in test mode, with captions and a voice). */
export const GUIDE_VIDEO = '/videos/stream-guide.mp4';
/** The main game's 90-second promo (the real site on a laptop and two phones playing a room). */
export const GAME_VIDEO = '/videos/game-promo.mp4';
/** «اكتشف طريقة اللعب» in 30 seconds, upright (phone) — the interactive tour recorded in the app, then a real game. */
export const TOUR_VIDEO = '/videos/tour-promo.mp4';

/**
 * Saves a video to the device so people can post it: on phones the share sheet (with «حفظ الفيديو» on iPhone,
 * and every app to post to), elsewhere a normal download of the file.
 */
export async function saveVideo(src: string, name: string, title: string) {
  const url = serverUrl(src);
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], name, { type: blob.type || 'video/mp4' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

/** «⬇️ حفظ الفيديو»: shows its progress while the file comes down. */
export function SaveVideoButton({ src, name, title, className }: { src: string; name: string; title: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await saveVideo(src, name, title);
        } finally {
          setBusy(false);
        }
      }}
      className={cn('min-h-11 shrink-0 rounded-full border border-q-gold/50 bg-q-gold/15 px-4 font-black text-q-gold hover:bg-q-gold/25 disabled:opacity-60', className)}
    >
      {busy ? '⏳ جاري التجهيز…' : '⬇️ حفظ الفيديو'}
    </button>
  );
}

type Props = {
  className?: string;
  label?: string;
  src?: string;
  title?: string;
  caption?: string;
  /** Upright video (9:19.5), shown tall and narrow. */
  portrait?: boolean;
  /** File name when saved; with it the window shows «حفظ الفيديو» (to post it anywhere). */
  saveAs?: string;
};

/** «🎬 شاهد الشرح»: opens a video in a window over the page (Esc or a tap outside closes it). */
export function VideoGuideButton({
  className,
  label = '🎬 شاهد الشرح',
  src = GUIDE_VIDEO,
  title = '🎬 شرح اللعب في البث',
  caption = 'كيف تبدأ البث وتلعب «جاوب أو بادل» مع الشات. والتفاصيل كاملة في «طريقة اللعب».',
  portrait = false,
  saveAs = `jawab-badel-${src.split('/').pop()}`,
}: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        data-qa="guide-video"
        onClick={() => setOpen(true)}
        className={cn('rounded-full border-[1.5px] border-q-gold/40 bg-q-gold/10 px-4 py-1.5 text-[13px] font-bold text-q-gold transition-colors hover:border-q-gold hover:bg-q-gold/20', className)}
      >
        {label}
      </button>
      {open && createPortal(
        // On <body> (above every page layer and corner button), inside the iPhone/Android safe areas.
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal
          aria-label={title}
          dir="rtl"
        >
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-black text-q-gold">{title}</span>
              <span className="flex-1" />
              {saveAs && <SaveVideoButton src={src} name={saveAs} title={title} className="me-2" />}
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 shrink-0 rounded-full border border-white/20 bg-white/10 px-4 font-black text-white hover:bg-white/20" aria-label="إغلاق">
                ✕ إغلاق
              </button>
            </div>
            <video
              // In the iPhone app these files are not in the bundle: they load from the site.
              src={serverUrl(src)}
              poster={serverUrl(src.replace('.mp4', '.jpg'))}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className={cn('rounded-2xl border border-white/10 bg-black shadow-2xl', portrait ? 'mx-auto aspect-[720/1560] max-h-[calc(100dvh-9rem)] w-auto max-w-full' : 'aspect-video max-h-[calc(100dvh-9rem)] w-full')}
            >
              متصفحك ما يعرض الفيديو.
            </video>
            <p className="mt-2 text-center text-xs text-white/60">{caption}</p>
            {saveAs && <p className="mt-1 text-center text-[11px] text-white/45">تقدر تحفظه وتنشره في حساباتك 🙌</p>}
          </div>
        </div>
      , document.body)}
    </>
  );
}

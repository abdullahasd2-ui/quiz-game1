import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** The stream guide video (the real site in test mode, with captions and a voice). */
export const GUIDE_VIDEO = '/videos/stream-guide.mp4';
/** The main game's 90-second promo (the real site on a laptop and two phones playing a room). */
export const GAME_VIDEO = '/videos/game-promo.mp4';

type Props = {
  className?: string;
  label?: string;
  src?: string;
  title?: string;
  caption?: string;
  /** Show the App Store QR under the video. */
  appQr?: boolean;
};

/** «🎬 شاهد الشرح»: opens a video in a window over the page (Esc or a tap outside closes it). */
export function VideoGuideButton({
  className,
  label = '🎬 شاهد الشرح',
  src = GUIDE_VIDEO,
  title = '🎬 شرح اللعب في البث',
  caption = 'كيف تبدأ البث وتلعب «جاوب أو بادل» مع الشات. والتفاصيل كاملة في «طريقة اللعب».',
  appQr = false,
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
      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" onClick={() => setOpen(false)} role="dialog" aria-modal aria-label={title}>
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-black text-q-gold">{title}</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label="إغلاق">
                ✕ إغلاق
              </button>
            </div>
            <video
              src={src}
              poster={src.replace('.mp4', '.jpg')}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-2xl border border-white/10 bg-black shadow-2xl"
            >
              متصفحك ما يعرض الفيديو.
            </video>
            <p className="mt-2 text-center text-xs text-white/60">{caption}</p>
            {appQr && (
              <div className="mx-auto mt-3 flex w-fit items-center gap-3 rounded-2xl border border-white/15 bg-q-bg/85 p-2.5 pe-4">
                <img src="/app-qr.svg" alt="رمز QR لتحميل التطبيق من App Store" className="size-20 rounded-lg bg-white p-1.5" />
                <div>
                  <div className="text-sm font-black text-white/90">📱 حمّل التطبيق</div>
                  <div className="text-xs font-bold text-white/50">امسح الرمز · App Store</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { serverUrl } from '@/lib/server';

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
};

/** «🎬 شاهد الشرح»: opens a video in a window over the page (Esc or a tap outside closes it). */
export function VideoGuideButton({
  className,
  label = '🎬 شاهد الشرح',
  src = GUIDE_VIDEO,
  title = '🎬 شرح اللعب في البث',
  caption = 'كيف تبدأ البث وتلعب «جاوب أو بادل» مع الشات. والتفاصيل كاملة في «طريقة اللعب».',
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
              className="aspect-video max-h-[calc(100dvh-9rem)] w-full rounded-2xl border border-white/10 bg-black shadow-2xl"
            >
              متصفحك ما يعرض الفيديو.
            </video>
            <p className="mt-2 text-center text-xs text-white/60">{caption}</p>
          </div>
        </div>
      , document.body)}
    </>
  );
}

const STREAM_URL = 'https://jawabbadel.com/kick/quiz';

/** Top-left on the home screen: to the Kick stream mode. In the iOS/Android app it opens the website in the browser. */
export function StreamerLink() {
  const native = Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  return (
    <a
      href={native ? STREAM_URL : '/kick/quiz'}
      target={native ? '_blank' : undefined}
      rel={native ? 'noopener noreferrer' : undefined}
      className="fixed top-[calc(env(safe-area-inset-top)+0.625rem)] left-2.5 z-40 flex items-center gap-1.5 rounded-full border border-[#53fc18]/40 bg-q-panel px-3.5 py-1.5 text-xs font-black text-white/85 shadow-[0_0_16px_-6px_rgba(83,252,24,0.6)] transition-colors hover:border-[#53fc18]"
    >
      <span className="grid size-4 place-items-center rounded-sm bg-[#53fc18] text-[10px] font-black leading-none text-black">K</span>
      للستريمر
    </a>
  );
}

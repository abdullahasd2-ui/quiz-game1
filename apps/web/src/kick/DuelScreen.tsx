import { SYNC_CODE_RE, type DuelClientToServerEvents, type DuelServerToClientEvents, type DuelView } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from '@/lib/server';
import { Background3D } from '@/game/fx/Background3D';
import { useWakeLock } from '@/lib/hotkeys';
import { DuelArena } from './DuelParts';
import { QrCode } from '@/lib/QrCode';

/** The iPhone app on the App Store: the broadcast shows its QR so viewers can get it. */
export const APP_STORE_URL = 'https://apps.apple.com/sa/app/%D8%AC%D8%A7%D9%88%D8%A8-%D8%A3%D9%88-%D8%A8%D8%A7%D8%AF%D9%84/id6818460065?l=ar';

/** «تحدي القنوات»: the page both streamers add to OBS. Shows what the host's control page publishes. */
export function DuelScreen() {
  const code = new URLSearchParams(window.location.search).get('code') ?? '';
  const [view, setView] = useState<DuelView | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  useWakeLock(true);
  // The broadcast sizes are for a 1080p OBS source; a phone or a small window gets the compact layout.
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    if (!SYNC_CODE_RE.test(code)) return setError('الرابط ناقص الكود — انسخه من صفحة التحكم');
    const sock: Socket<DuelServerToClientEvents, DuelClientToServerEvents> = io(`${SERVER_URL}/duel-sync`);
    sock.on('connect', () => sock.emit('duel:watch', code, (res) => !res.ok && setError(res.error ?? 'تعذّر الاتصال')));
    sock.on('duel:view', (v) => {
      setView(v);
      setOffset(Date.now() - v.hostNow);
    });
    sock.on('connect_error', () => setError('تعذّر الاتصال بالسيرفر'));
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(t);
      sock.disconnect();
    };
  }, [code]);
  const s = view?.state ?? null;
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-q-bg p-6 text-white" dir="rtl">
      <div className="q-aurora" aria-hidden />
      <Background3D />
      <div className="relative grid min-h-[calc(100dvh-3rem)] place-items-center">
        {s ? (
          <DuelArena s={s} now={now - offset} big={wide} sound />
        ) : (
          <div className="grid min-h-[80dvh] place-items-center text-center">
            <div>
              <div className="q-display text-6xl">⚔️ تحدي القنوات</div>
              <div className="mt-3 text-2xl text-white/60">{error || 'ننتظر الستريمر يفتح التحدي…'}</div>
            </div>
          </div>
        )}
      </div>
      {/* The app's QR, always in the corner (small, out of the game's way). */}
      <div className="fixed bottom-4 left-4 z-20 rounded-2xl border border-white/15 bg-black/60 p-2 backdrop-blur">
        <QrCode text={APP_STORE_URL} label="📱 حمّل تطبيق جاوب أو بادل" className={wide ? 'w-32' : 'w-20'} />
      </div>
    </div>
  );
}

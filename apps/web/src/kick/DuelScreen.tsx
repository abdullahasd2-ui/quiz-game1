import { SYNC_CODE_RE, type DuelClientToServerEvents, type DuelServerToClientEvents, type DuelView } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from '@/lib/server';
import { Background3D } from '@/game/fx/Background3D';
import { useWakeLock } from '@/lib/hotkeys';
import { DuelArena } from './DuelParts';

/** «تحدي القنوات»: the page both streamers add to OBS. Shows what the host's control page publishes. */
export function DuelScreen() {
  const code = new URLSearchParams(window.location.search).get('code') ?? '';
  const [view, setView] = useState<DuelView | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  useWakeLock(true);
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
    <div className="min-h-dvh overflow-hidden bg-q-bg p-6 text-white" dir="rtl">
      <Background3D />
      <div className="relative grid min-h-[calc(100dvh-3rem)] place-items-center">
        {s ? (
          <DuelArena s={s} now={now - offset} big />
        ) : (
          <div className="grid min-h-[80dvh] place-items-center text-center">
            <div>
              <div className="q-display text-6xl">⚔️ تحدي القنوات</div>
              <div className="mt-3 text-2xl text-white/60">{error || 'ننتظر الستريمر يفتح التحدي…'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

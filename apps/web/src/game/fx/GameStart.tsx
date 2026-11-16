import { useEffect, useRef, useState } from 'react';
import type { RoomStatus } from '@quiz/shared';

/** Lobby → game: a short burst of light with «يلا نبدأ!» (about a second, never blocks a tap). */
export function GameStart({ status }: { status: RoomStatus | null }) {
  const prev = useRef(status);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (prev.current === 'lobby' && status === 'playing') {
      setShow(true);
      const t = setTimeout(() => setShow(false), 1100);
      prev.current = status;
      return () => clearTimeout(t);
    }
    prev.current = status;
  }, [status]);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] grid place-items-center" aria-hidden>
      <div className="absolute size-[140vmax] rounded-full bg-[radial-gradient(circle,rgba(247,201,72,0.45),rgba(168,85,247,0.25)_35%,transparent_60%)] motion-safe:animate-launch" />
      <div className="q-display relative text-6xl text-white drop-shadow-[0_0_24px_rgba(247,201,72,0.8)] motion-safe:animate-launch sm:text-8xl">يلا نبدأ!</div>
    </div>
  );
}

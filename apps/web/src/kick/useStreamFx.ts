import type { StreamState } from '@quiz/shared';
import { useEffect, useRef } from 'react';
import { play } from '@/game/fx/sound';

/** Sounds on the broadcast page, from what changed in the game (same synthesized cues as the main game). */
export function useStreamFx(state: StreamState | null, secondsLeft: number | null) {
  const prev = useRef<StreamState | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (!state || !before) return;
    if (state.joined.length > before.joined.length) play('pop');
    if (state.phase === before.phase) return;
    switch (state.phase) {
      case 'board':
        if (before.phase === 'lobby') play('boom'), play('whoosh', 0.12);
        else play('whoosh');
        break;
      case 'streamer':
        play('whoosh');
        play('pop', 0.16);
        break;
      case 'choose':
        play('lock');
        break;
      case 'answer':
        play('whoosh');
        play('ding', 0.1);
        break;
      case 'result': {
        const rows = Object.values(state.result?.rows ?? {});
        play(rows.some((r) => r.delta > 0) ? 'win' : 'wrong');
        if (rows.some((r) => r.streak)) play('boom', 0.7), play('fanfare', 0.85);
        break;
      }
      case 'over':
        play('fanfare');
        break;
    }
  }, [state]);

  // The last five seconds tick, the last two urgently.
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secondsLeft === null || secondsLeft > 5 || secondsLeft <= 0 || lastTick.current === secondsLeft) return;
    lastTick.current = secondsLeft;
    play(secondsLeft <= 2 ? 'tickUrgent' : 'tick');
  }, [secondsLeft]);
}

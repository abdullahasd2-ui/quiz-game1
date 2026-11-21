import { teamSize, type DuelState } from '@quiz/shared';
import { useEffect, useRef } from 'react';
import { play } from '@/game/fx/sound';

/**
 * Sounds tied to what happens in the challenge: a question starts (whoosh), a fireball flies and lands (whoosh + boom),
 * a chain link (ding) or a broken chain (wrong + boom), a «فزعة» (pop), a round won (ding), the victory (fanfare + win).
 */
export function useDuelSounds(s: DuelState | null, on: boolean) {
  const last = useRef<{ key: string; phase: string; live: number }>({ key: '', phase: '', live: 0 });
  // The castle's drawbridge comes down for each newcomer.
  const sizes = useRef<string>('');
  useEffect(() => {
    if (!s || !on || s.settings.mode !== 'castle') return;
    const now = `${teamSize(s, 'a')}:${teamSize(s, 'b')}`;
    const was = sizes.current;
    sizes.current = now;
    if (!was || now === was) return;
    const [a0, b0] = was.split(':').map(Number);
    if (teamSize(s, 'a') > a0! || teamSize(s, 'b') > b0!) play('gate');
  }, [s, on]);
  useEffect(() => {
    if (!s || !on) return;
    const key = `${s.session}:${s.rounds}`;
    const live = (s.round?.live.a ?? 0) + (s.round?.live.b ?? 0);
    const before = last.current;
    last.current = { key, phase: s.phase, live };
    if (s.phase === before.phase && key === before.key) {
      if (s.phase === 'question' && s.settings.mode === 'faza' && live > before.live) play('pop');
      return;
    }
    if (s.phase === 'question') return play('whoosh');
    const res = s.round?.result;
    if ((s.phase === 'result' || s.phase === 'over') && res && key !== before.key) {
      if (s.settings.mode === 'castle' && ((res.damage?.a ?? 0) > 0 || (res.damage?.b ?? 0) > 0)) {
        play('whoosh');
        play('boom', 0.9);
      } else if (s.settings.mode === 'chain') play(res.gained ? 'ding' : res.broke ? 'boom' : 'wrong');
      else if (s.settings.mode === 'faza') play(res.winner ? 'ding' : 'wrong');
    }
    if (s.phase === 'over') {
      play('fanfare', s.settings.mode === 'castle' ? 1.6 : 0.4);
      play('win', s.settings.mode === 'castle' ? 2.4 : 1.2);
    }
  }, [s, on]);
}

import type { RoomView } from '@quiz/shared';
import { useEffect, useRef } from 'react';
import { play } from './sound';
import { cuesFor } from './transitions';

/**
 * Plays the sound effects that go with what just changed in the room. One place, watching the room state, so the
 * screens stay untouched: the same cues fire on every device, whoever caused the change.
 */
export function useGameFx(view: RoomView | null) {
  const prev = useRef<RoomView | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (!view) return;
    for (const [cue, delay] of cuesFor(before, view)) play(cue, delay);
  }, [view]);
}

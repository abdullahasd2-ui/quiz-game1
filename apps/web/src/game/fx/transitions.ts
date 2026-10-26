import type { RoomView } from '@quiz/shared';
import type { Cue } from './cues';

/** A cue and how many seconds to wait before it starts. */
export type Planned = readonly [cue: Cue, delaySeconds: number];

const memberCount = (view: RoomView) => (view.teams[0]?.members.length ?? 0) + (view.teams[1]?.members.length ?? 0);

/**
 * Which sound effects go with the change from the previous room state to this one. Pure (no audio, no React), so
 * the rules can be tested; `useGameFx` plays whatever this returns.
 */
export function cuesFor(prev: RoomView | null, view: RoomView): Planned[] {
  if (!prev) return [['ding', 0]]; // you created, joined, or came back to a room

  // Lobby: someone arrived.
  if (view.status === 'lobby') {
    if (!prev.teams[1] && view.teams[1]) return [['ding', 0]];
    if (memberCount(view) > memberCount(prev)) return [['pop', 0]];
    return [];
  }

  if (prev.status === 'lobby' && view.status === 'playing') {
    return [
      ['boom', 0],
      ['whoosh', 0.12],
    ];
  }

  if (view.status === 'done') return prev.status === 'done' ? [] : [['fanfare', 0]];

  if (view.phase !== prev.phase) {
    if (view.phase === 'result') return resultCues(view);
    return view.phase === 'action'
      ? [
          ['whoosh', 0],
          ['pop', 0.16],
        ]
      : [['whoosh', 0]];
  }

  // You locked in your secret choice or your answer.
  if ((prev.myAction === null && view.myAction !== null) || (prev.myAnswer === null && view.myAnswer !== null)) return [['lock', 0]];
  return [];
}

/** A steal gets its swap whoosh first, then the verdict for the seat that is looking. */
function resultCues(view: RoomView): Planned[] {
  const r = view.result;
  if (!r) return [];
  const steal = r.actions.includes('steal');
  const out: Planned[] = steal ? [['swap', 0]] : [];
  const delay = steal ? 0.42 : 0;
  const mine = view.you === 'tv' ? null : r.deltas[view.you];
  if (mine === null) out.push([r.deltas.some((d) => d > 0) ? 'win' : 'pop', delay]);
  else if (mine > 0) out.push(['win', delay]);
  else if (mine < 0) out.push(['wrong', delay]);
  else if (!steal) out.push(['pop', 0]);
  return out;
}

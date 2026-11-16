// The player's own record on this device: games played, won, lost and drawn, per game mode.
// Only kept in the browser (nothing is sent anywhere), and filled in when a game reaches its final screen.
import { useSyncExternalStore } from 'react';
import type { RoomView, Variant } from '@quiz/shared';

export type LocalStats = { games: number; wins: number; losses: number; draws: number; best: number; byVariant: Partial<Record<Variant, number>>; last: string[] };
const KEY = 'jab:stats';
const EMPTY: LocalStats = { games: 0, wins: 0, losses: 0, draws: 0, best: 0, byVariant: {}, last: [] };
let cache: LocalStats | null = null;
const subs = new Set<() => void>();

function read(): LocalStats {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) };
  } catch {
    cache = EMPTY;
  }
  return cache!;
}

/** Records a finished game once (keyed by room code + questions played). Spectators (the TV) record nothing. */
export function recordGame(view: RoomView) {
  if (view.status !== 'done' || view.you === 'tv') return;
  const id = `${view.code}:${view.used.length}`;
  const s = read();
  if (s.last.includes(id)) return;
  const me = view.teams[view.you]?.score ?? 0;
  const other = view.teams[view.you === 0 ? 1 : 0]?.score ?? 0;
  const next: LocalStats = {
    games: s.games + 1,
    wins: s.wins + (me > other ? 1 : 0),
    losses: s.losses + (me < other ? 1 : 0),
    draws: s.draws + (me === other ? 1 : 0),
    best: Math.max(s.best, me),
    byVariant: { ...s.byVariant, [view.variant]: (s.byVariant[view.variant] ?? 0) + 1 },
    last: [id, ...s.last].slice(0, 20),
  };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: the record lasts for this visit.
  }
  subs.forEach((f) => f());
}

export function useLocalStats(): LocalStats {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    read,
    () => EMPTY,
  );
}

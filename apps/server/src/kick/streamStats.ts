import type { StreamState } from '@quiz/shared';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { kickStreams } from '../db/schema';

type Seen = { players: number; rounds: number; phase: string; variant: string | null };

/**
 * Writes a stream session's progress as the control page syncs: one row per session, updated only when something that
 * the stats show has changed (players, rounds, phase, mode). Failures are logged and never break the game.
 */
export function createStreamRecorder(log: (err: unknown) => void) {
  const seen = new Map<string, Seen>();
  return async (st: StreamState) => {
    if (!st.session) return;
    const now: Seen = { players: st.joined.length, rounds: st.used.length, phase: st.phase, variant: st.variant ?? null };
    const before = seen.get(st.session);
    if (before && before.players === now.players && before.rounds === now.rounds && before.phase === now.phase && before.variant === now.variant) return;
    seen.set(st.session, now);
    if (seen.size > 2000) seen.delete(seen.keys().next().value!);
    const inGame = st.phase !== 'lobby';
    const over = st.phase === 'over';
    try {
      await db
        .insert(kickStreams)
        .values({
          session: st.session,
          channel: (st.names[st.streamer] ?? st.streamer).slice(0, 64),
          variant: inGame ? now.variant ?? 'swap' : null,
          test: Boolean(st.test),
          players: now.players,
          rounds: now.rounds,
          gameStartedAt: inGame ? new Date() : null,
          finishedAt: over ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: kickStreams.session,
          set: {
            players: sql`greatest(${kickStreams.players}, ${now.players})`,
            rounds: sql`greatest(${kickStreams.rounds}, ${now.rounds})`,
            variant: inGame ? sql`coalesce(${now.variant ?? 'swap'}, ${kickStreams.variant})` : sql`${kickStreams.variant}`,
            gameStartedAt: inGame ? sql`coalesce(${kickStreams.gameStartedAt}, now())` : sql`${kickStreams.gameStartedAt}`,
            finishedAt: over ? sql`coalesce(${kickStreams.finishedAt}, now())` : sql`${kickStreams.finishedAt}`,
            lastSeenAt: sql`now()`,
          },
        });
    } catch (err) {
      log(err);
    }
  };
}

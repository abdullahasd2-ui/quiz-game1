import { teamSize, type DuelState } from '@quiz/shared';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { kickDuels } from '../db/schema';

/**
 * Writes «تحدي القنوات» progress for the admin stats: one row per challenge (its session), updated only when
 * what the stats show changes (players, rounds, phase). Failures are logged and never break the game.
 */
export function createDuelRecorder(log: (err: unknown) => void) {
  const seen = new Map<string, string>();
  return async (st: DuelState) => {
    if (!st.session) return;
    const a = teamSize(st, 'a');
    const b = teamSize(st, 'b');
    const sig = `${a}:${b}:${st.rounds}:${st.phase}`;
    if (seen.get(st.session) === sig) return;
    seen.set(st.session, sig);
    if (seen.size > 2000) seen.delete(seen.keys().next().value!);
    const inGame = st.phase !== 'lobby';
    const over = st.phase === 'over';
    const winner = over ? (st.winner ?? 'draw') : null;
    try {
      await db
        .insert(kickDuels)
        .values({
          session: st.session.slice(0, 32),
          mode: st.settings.mode,
          single: Boolean(st.single),
          test: Boolean(st.test),
          channelA: (st.channels.a || '—').slice(0, 64),
          channelB: (st.single ? (st.captain ?? '') : st.channels.b || '—').slice(0, 64),
          playersA: a,
          playersB: b,
          rounds: st.rounds,
          winner,
          gameStartedAt: inGame ? new Date() : null,
          finishedAt: over ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: kickDuels.session,
          set: {
            playersA: sql`greatest(${kickDuels.playersA}, ${a})`,
            playersB: sql`greatest(${kickDuels.playersB}, ${b})`,
            rounds: sql`greatest(${kickDuels.rounds}, ${st.rounds})`,
            channelB: st.single ? (st.captain ?? '').slice(0, 64) : sql`${kickDuels.channelB}`,
            winner: winner ?? sql`${kickDuels.winner}`,
            gameStartedAt: inGame ? sql`coalesce(${kickDuels.gameStartedAt}, now())` : sql`${kickDuels.gameStartedAt}`,
            finishedAt: over ? sql`coalesce(${kickDuels.finishedAt}, now())` : sql`${kickDuels.finishedAt}`,
            lastSeenAt: sql`now()`,
          },
        });
    } catch (err) {
      log(err);
    }
  };
}

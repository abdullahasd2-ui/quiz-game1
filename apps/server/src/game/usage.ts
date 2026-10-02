import type { Platform } from '@quiz/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { db } from '../db/client';
import { dailyVisits, games } from '../db/schema';
import type { GameRoom } from './room';

/** Stats days follow Saudi time, so "today" matches the players' day. */
export const STATS_TIMEZONE = 'Asia/Riyadh';
export const statsToday = sql<string>`(now() at time zone ${STATS_TIMEZONE})::date`;

/** A reconnect within this long of the last one is the same visit. */
const VISIT_GAP = sql`interval '30 minutes'`;

/**
 * Records visits and games for the admin stats. Writes run in the background and never
 * fail gameplay: a stats hiccup is logged and dropped.
 */
export class UsageLog {
  private readonly gameIds = new WeakMap<GameRoom, Promise<number | null>>();
  private readonly pending = new Set<Promise<unknown>>();
  private readonly endedRooms = new WeakSet<GameRoom>();

  constructor(private readonly log: FastifyBaseLogger) {}

  visit(deviceId: string, platform: Platform) {
    this.track(
      db
        .insert(dailyVisits)
        .values({ day: statsToday, deviceId, platform })
        .onConflictDoUpdate({
          target: [dailyVisits.day, dailyVisits.deviceId],
          set: {
            visits: sql`${dailyVisits.visits} + case when ${dailyVisits.lastSeenAt} < now() - ${VISIT_GAP} then 1 else 0 end`,
            lastSeenAt: sql`now()`,
            platform: sql`excluded.platform`,
          },
        }),
    );
  }

  /** Keeps the visit open while the device stays connected. */
  left(deviceId: string) {
    this.track(db.update(dailyVisits).set({ lastSeenAt: sql`now()` }).where(and(eq(dailyVisits.day, statsToday), eq(dailyVisits.deviceId, deviceId))));
  }

  created(room: GameRoom) {
    const id = db
      .insert(games)
      .values({ code: room.code, mode: room.mode, variant: room.variant })
      .returning({ id: games.id })
      .then((rows) => rows[0]?.id ?? null);
    this.gameIds.set(room, this.track(id).then((v) => v ?? null));
  }

  started(room: GameRoom) {
    this.update(room, { startedAt: new Date(), categoryIds: room.categories.map((c) => c.id) });
  }

  /** Called whenever a room ends: after the last round, or closed/idle before it. */
  ended(room: GameRoom) {
    // A finished room is closed again later when it goes idle; keep the first ending.
    if (this.endedRooms.has(room)) return;
    this.endedRooms.add(room);
    const scores: [number, number] = [room.teams[0]?.score ?? 0, room.teams[1]?.score ?? 0];
    const end = room.status === 'done' ? { finishedAt: new Date() } : { abandonedAt: new Date() };
    this.update(room, { ...end, roundsPlayed: room.used.size, scores });
  }

  /** Waits for in-flight writes (on shutdown, before the DB pool closes). */
  async flush() {
    await Promise.allSettled([...this.pending]);
  }

  private update(room: GameRoom, values: Partial<typeof games.$inferInsert>) {
    const id = this.gameIds.get(room);
    if (!id) return;
    this.track(id.then((gameId) => (gameId === null ? undefined : db.update(games).set(values).where(eq(games.id, gameId)))));
  }

  /** Runs a write in the background; failures are logged, never thrown. */
  private track<T>(work: PromiseLike<T>): Promise<T | undefined> {
    const p = Promise.resolve(work).catch((err: unknown) => {
      this.log.warn({ err }, 'usage stats write failed');
      return undefined;
    });
    this.pending.add(p);
    void p.finally(() => this.pending.delete(p));
    return p;
  }
}

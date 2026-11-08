import { publicView, SYNC_CODE_RE, type KickLiveStream, type StreamState, type SyncClientToServerEvents, type SyncServerToClientEvents, type SyncView } from '@quiz/shared';
import type { Server } from 'socket.io';

const MAX_ROOMS = 200;
const MAX_BYTES = 100_000;

/**
 * Socket.IO namespace `/kick-sync`: the streamer's private control page publishes a scrubbed view of the game,
 * and the broadcast page that watches the same code displays it. The first publisher of a code owns it.
 */
export function attachKickSync(io: Server, opts: { onState?: (s: StreamState) => void } = {}) {
  const ns = io.of('/kick-sync');
  const rooms = new Map<string, { hostKey: string; hostSocket: string; last: SyncView | null; idle: ReturnType<typeof setTimeout> | null; seenAt: number; since: number }>();
  /** Streams running now: a control page synced in the last two minutes and the game not over. */
  const live = (): KickLiveStream[] =>
    [...rooms.values()]
      .filter((r) => r.last?.state && r.last.state.phase !== 'over' && Date.now() - r.seenAt < 120_000)
      .map((r) => {
        const st = r.last!.state!;
        return { channel: st.names[st.streamer] ?? st.streamer, variant: st.phase === 'lobby' ? null : st.variant ?? 'swap', phase: st.phase, players: st.joined.length, rounds: st.used.length, totalRounds: st.totalCells, test: Boolean(st.test), since: r.since };
      })
      .sort((a, b) => b.players - a.players);
  ns.on('connection', (socket) => {
    const typed = socket as unknown as {
      on: <E extends keyof SyncClientToServerEvents>(e: E, fn: SyncClientToServerEvents[E]) => void;
    };
    typed.on('sync:watch', (code, reply) => {
      if (typeof code !== 'string' || !SYNC_CODE_RE.test(code)) return reply({ ok: false, error: 'كود غير صالح' });
      void socket.join(code);
      const last = rooms.get(code)?.last;
      if (last) (socket as unknown as { emit: (e: keyof SyncServerToClientEvents, v: SyncView) => void }).emit('sync:view', last);
      reply({ ok: true, hosted: rooms.has(code) });
    });
    typed.on('sync:publish', (m, reply) => {
      if (!m || typeof m.code !== 'string' || !SYNC_CODE_RE.test(m.code) || typeof m.hostKey !== 'string' || m.hostKey.length < 16) return reply({ ok: false, error: 'طلب غير صالح' });
      if (JSON.stringify(m).length > MAX_BYTES) return reply({ ok: false, error: 'كبير' });
      let room = rooms.get(m.code);
      if (!room) {
        if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: 'كثير جلسات شغّالة' });
        room = { hostKey: m.hostKey, hostSocket: socket.id, last: null, idle: null, seenAt: Date.now(), since: Date.now() };
        rooms.set(m.code, room);
      } else if (room.hostKey !== m.hostKey) return reply({ ok: false, error: 'هذا الكود مستخدم' });
      // Scrubbed here too, so a page bug can never put the streamer's secret on the broadcast.
      room.hostSocket = socket.id;
      room.seenAt = Date.now();
      if (m.state && room.last?.state?.session !== m.state.session) room.since = Date.now();
      if (m.state) opts.onState?.(m.state);
      room.last = { state: m.state && publicView(m.state), hostNow: m.hostNow };
      if (room.idle) clearTimeout(room.idle);
      const code = m.code;
      room.idle = setTimeout(() => rooms.delete(code), 6 * 3600_000);
      ns.to(code).emit('sync:view', room.last);
      reply({ ok: true });
    });
    typed.on('sync:pick', (m, reply) => {
      const room = m && typeof m.code === 'string' ? rooms.get(m.code) : undefined;
      // Only a page watching this code (the broadcast screen) may pick, and only numbers go through.
      if (!room || !socket.rooms.has(m.code) || !Number.isInteger(m.category) || !Number.isInteger(m.points)) return reply({ ok: false, error: 'غير مسموح' });
      ns.to(room.hostSocket).emit('sync:pick', { code: m.code, category: m.category, points: m.points });
      reply({ ok: true });
    });
  });
  return { live };
}

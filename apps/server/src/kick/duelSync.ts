import { duelPublicView, SYNC_CODE_RE, teamSize, type DuelClientToServerEvents, type DuelLive, type DuelServerToClientEvents, type DuelState, type DuelView } from '@quiz/shared';
import type { Server } from 'socket.io';

const MAX_ROOMS = 200;
const MAX_BYTES = 150_000;

/**
 * Socket.IO namespace `/duel-sync` for «تحدي القنوات»: the host streamer's control page publishes the game, and both
 * streamers' broadcast pages (the same code) show it. The first publisher of a code owns it.
 */
export function attachDuelSync(io: Server, record?: (s: DuelState) => void) {
  const ns = io.of('/duel-sync');
  const rooms = new Map<string, { hostKey: string; last: DuelView | null; idle: ReturnType<typeof setTimeout> | null; since: number; seen: number }>();
  ns.on('connection', (socket) => {
    const typed = socket as unknown as {
      on: <E extends keyof DuelClientToServerEvents>(e: E, fn: DuelClientToServerEvents[E]) => void;
      emit: <E extends keyof DuelServerToClientEvents>(e: E, ...a: Parameters<DuelServerToClientEvents[E]>) => void;
    };
    typed.on('duel:watch', (code, reply) => {
      if (typeof code !== 'string' || !SYNC_CODE_RE.test(code)) return reply({ ok: false, error: 'كود غير صالح' });
      void socket.join(code);
      const last = rooms.get(code)?.last;
      if (last) typed.emit('duel:view', last);
      reply({ ok: true, hosted: rooms.has(code) });
    });
    typed.on('duel:publish', (m, reply) => {
      if (!m || typeof m.code !== 'string' || !SYNC_CODE_RE.test(m.code) || typeof m.hostKey !== 'string' || m.hostKey.length < 16) return reply({ ok: false, error: 'طلب غير صالح' });
      if (JSON.stringify(m).length > MAX_BYTES) return reply({ ok: false, error: 'كبير' });
      let room = rooms.get(m.code);
      if (!room) {
        if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: 'كثير جلسات شغّالة' });
        room = { hostKey: m.hostKey, last: null, idle: null, since: Date.now(), seen: Date.now() };
        rooms.set(m.code, room);
      } else if (room.hostKey !== m.hostKey) return reply({ ok: false, error: 'هذا الكود مستخدم' });
      // Scrubbed here too, so a page bug can never put the answer on the broadcast.
      room.last = { state: m.state && duelPublicView(m.state), hostNow: m.hostNow };
      room.seen = Date.now();
      if (m.state && record) record(m.state);
      if (room.idle) clearTimeout(room.idle);
      const code = m.code;
      room.idle = setTimeout(() => rooms.delete(code), 6 * 3600_000);
      ns.to(code).emit('duel:view', room.last);
      reply({ ok: true });
    });
  });

  /** The challenges open now (their host page published in the last few minutes), for the admin dashboard. */
  function live(): DuelLive[] {
    const out: DuelLive[] = [];
    const cutoff = Date.now() - 5 * 60_000;
    for (const [code, r] of rooms) {
      const s = r.last?.state;
      if (!s || r.seen < cutoff) continue;
      const score = s.settings.mode === 'castle' ? s.hp : s.settings.mode === 'faza' ? s.wins : s.points;
      out.push({
        code,
        mode: s.settings.mode,
        single: Boolean(s.single),
        test: Boolean(s.test),
        channels: { a: s.channels.a, b: s.single ? (s.captain ? `👑 ${s.captain}` : '—') : s.channels.b },
        players: { a: teamSize(s, 'a'), b: teamSize(s, 'b') },
        score,
        phase: s.phase,
        rounds: s.rounds,
        winner: s.winner,
        since: r.since,
      });
    }
    return out.sort((x, y) => y.since - x.since);
  }
  return { live };
}

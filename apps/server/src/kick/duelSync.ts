import { duelPublicView, SYNC_CODE_RE, type DuelClientToServerEvents, type DuelServerToClientEvents, type DuelView } from '@quiz/shared';
import type { Server } from 'socket.io';

const MAX_ROOMS = 200;
const MAX_BYTES = 150_000;

/**
 * Socket.IO namespace `/duel-sync` for «تحدي القنوات»: the host streamer's control page publishes the game, and both
 * streamers' broadcast pages (the same code) show it. The first publisher of a code owns it.
 */
export function attachDuelSync(io: Server) {
  const ns = io.of('/duel-sync');
  const rooms = new Map<string, { hostKey: string; last: DuelView | null; idle: ReturnType<typeof setTimeout> | null }>();
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
        room = { hostKey: m.hostKey, last: null, idle: null };
        rooms.set(m.code, room);
      } else if (room.hostKey !== m.hostKey) return reply({ ok: false, error: 'هذا الكود مستخدم' });
      // Scrubbed here too, so a page bug can never put the answer on the broadcast.
      room.last = { state: m.state && duelPublicView(m.state), hostNow: m.hostNow };
      if (room.idle) clearTimeout(room.idle);
      const code = m.code;
      room.idle = setTimeout(() => rooms.delete(code), 6 * 3600_000);
      ns.to(code).emit('duel:view', room.last);
      reply({ ok: true });
    });
  });
}

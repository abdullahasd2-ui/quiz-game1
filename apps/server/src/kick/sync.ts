import { publicView, SYNC_CODE_RE, type SyncClientToServerEvents, type SyncServerToClientEvents, type SyncView } from '@quiz/shared';
import type { Server } from 'socket.io';

const MAX_ROOMS = 200;
const MAX_BYTES = 100_000;

/**
 * Socket.IO namespace `/kick-sync`: the streamer's private control page publishes a scrubbed view of the game,
 * and the broadcast page that watches the same code displays it. The first publisher of a code owns it.
 */
export function attachKickSync(io: Server) {
  const ns = io.of('/kick-sync');
  const rooms = new Map<string, { hostKey: string; last: SyncView | null; idle: ReturnType<typeof setTimeout> | null }>();
  ns.on('connection', (socket) => {
    const typed = socket as unknown as {
      on: <E extends keyof SyncClientToServerEvents>(e: E, fn: SyncClientToServerEvents[E]) => void;
    };
    typed.on('sync:watch', (code, reply) => {
      if (typeof code !== 'string' || !SYNC_CODE_RE.test(code)) return reply({ ok: false, error: 'كود غير صالح' });
      void socket.join(code);
      const last = rooms.get(code)?.last;
      if (last) (socket as unknown as { emit: (e: keyof SyncServerToClientEvents, v: SyncView) => void }).emit('sync:view', last);
      reply({ ok: true });
    });
    typed.on('sync:publish', (m, reply) => {
      if (!m || typeof m.code !== 'string' || !SYNC_CODE_RE.test(m.code) || typeof m.hostKey !== 'string' || m.hostKey.length < 16) return reply({ ok: false, error: 'طلب غير صالح' });
      if (JSON.stringify(m).length > MAX_BYTES) return reply({ ok: false, error: 'كبير' });
      let room = rooms.get(m.code);
      if (!room) {
        if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: 'كثير جلسات شغّالة' });
        room = { hostKey: m.hostKey, last: null, idle: null };
        rooms.set(m.code, room);
      } else if (room.hostKey !== m.hostKey) return reply({ ok: false, error: 'هذا الكود مستخدم' });
      // Scrubbed here too, so a page bug can never put the streamer's secret on the broadcast.
      room.last = { state: m.state && publicView(m.state), hostNow: m.hostNow };
      if (room.idle) clearTimeout(room.idle);
      const code = m.code;
      room.idle = setTimeout(() => rooms.delete(code), 6 * 3600_000);
      ns.to(code).emit('sync:view', room.last);
      reply({ ok: true });
    });
  });
}

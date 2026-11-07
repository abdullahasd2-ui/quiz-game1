import { SYNC_CODE_RE, type ControlAct, type SyncClientToServerEvents, type SyncServerToClientEvents, type SyncView } from '@quiz/shared';
import type { Server } from 'socket.io';
import { z } from 'zod';

const MAX_ROOMS = 200;
const MAX_BYTES = 100_000;
const actSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('answer'), index: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal('swap'), user: z.string().min(1).max(60) }),
]);
const keyOk = (k: unknown): k is string => typeof k === 'string' && k.length >= 16 && k.length <= 64;

/**
 * Socket.IO namespace `/kick-sync`: the broadcast page (the host) publishes the full game here, and the streamer's private
 * control page, which knows the secret key from its link, sees it and sends back his choices. Viewers only ever see the host page.
 */
export function attachKickSync(io: Server) {
  const ns = io.of('/kick-sync');
  const rooms = new Map<string, { hostKey: string; controlKey: string; last: SyncView | null; idle: ReturnType<typeof setTimeout> | null }>();
  ns.on('connection', (socket) => {
    const typed = socket as unknown as {
      on: <E extends keyof SyncClientToServerEvents>(e: E, fn: SyncClientToServerEvents[E]) => void;
      emit: <E extends keyof SyncServerToClientEvents>(e: E, ...a: Parameters<SyncServerToClientEvents[E]>) => void;
    };
    typed.on('sync:publish', (m, reply) => {
      if (!m || typeof m.code !== 'string' || !SYNC_CODE_RE.test(m.code) || !keyOk(m.hostKey) || !keyOk(m.controlKey)) return reply({ ok: false, error: 'طلب غير صالح' });
      if (JSON.stringify(m).length > MAX_BYTES) return reply({ ok: false, error: 'كبير' });
      let room = rooms.get(m.code);
      if (!room) {
        if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: 'كثير جلسات شغّالة' });
        room = { hostKey: m.hostKey, controlKey: m.controlKey, last: null, idle: null };
        rooms.set(m.code, room);
      } else if (room.hostKey !== m.hostKey) return reply({ ok: false, error: 'هذا الكود مستخدم' });
      void socket.join(`${m.code}:host`);
      room.last = { state: m.state, hostNow: m.hostNow };
      if (room.idle) clearTimeout(room.idle);
      const code = m.code;
      room.idle = setTimeout(() => rooms.delete(code), 6 * 3600_000);
      ns.to(`${code}:ctl`).emit('sync:view', room.last);
      reply({ ok: true });
    });
    typed.on('sync:control', (m, reply) => {
      const room = m && typeof m.code === 'string' ? rooms.get(m.code) : undefined;
      if (!room || m.key !== room.controlKey) return reply({ ok: false, error: 'رابط التحكم غير صحيح أو انتهت الجلسة — افتحه من جديد من صفحة اللعبة' });
      void socket.join(`${m.code}:ctl`);
      if (room.last) typed.emit('sync:view', room.last);
      reply({ ok: true });
    });
    typed.on('sync:act', (m, reply) => {
      const room = m && typeof m.code === 'string' ? rooms.get(m.code) : undefined;
      const act = actSchema.safeParse(m?.act);
      if (!room || m.key !== room.controlKey || !act.success) return reply({ ok: false, error: 'غير مسموح' });
      ns.to(`${m.code}:host`).emit('sync:act', act.data as ControlAct);
      reply({ ok: true });
    });
  });
}

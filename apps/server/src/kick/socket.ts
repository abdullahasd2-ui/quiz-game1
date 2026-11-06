import { KICK_CHANNEL_RE, type KickClientToServerEvents, type KickServerToClientEvents } from '@quiz/shared';
import type { Server } from 'socket.io';
import { z } from 'zod';
import type { KickChatHub } from './chat';

const watchInput = z.object({
  channel: z.string().trim().regex(KICK_CHANNEL_RE, 'اسم القناة غير صالح'),
  chatroomId: z.number().int().positive().optional(),
  official: z.boolean().optional(),
});

/** Socket.IO namespace `/kick`: a stream page watches one channel's chat. */
export function attachKickRelay(io: Server, hub: KickChatHub) {
  const ns = io.of('/kick');
  ns.on('connection', (socket) => {
    let stop: (() => void) | null = null;
    const typed = socket as unknown as {
      emit: <E extends keyof KickServerToClientEvents>(e: E, ...a: Parameters<KickServerToClientEvents[E]>) => void;
      on: <E extends keyof KickClientToServerEvents>(e: E, fn: KickClientToServerEvents[E]) => void;
    };
    typed.on('kick:watch', (input, reply) => {
      const parsed = watchInput.safeParse(input);
      if (!parsed.success) return reply({ ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
      stop?.();
      try {
        stop = hub.watch(parsed.data.channel, parsed.data.chatroomId, {
          onMessage: (m) => typed.emit('kick:message', m),
          onStatus: (s) => typed.emit('kick:status', s),
        }, parsed.data.official);
        reply({ ok: true, data: null });
      } catch (err) {
        reply({ ok: false, error: err instanceof Error ? err.message : 'تعذّر الاتصال' });
      }
    });
    socket.on('disconnect', () => stop?.());
  });
}

import { randomInt } from 'node:crypto';
import {
  actionInput,
  platforms,
  answerInput,
  createRoomInput,
  joinRoomInput,
  pickCellInput,
  POINTS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  startGameInput,
  type Ack,
  type ClientToServerEvents,
  type LiveStats,
  type ServerToClientEvents,
} from '@quiz/shared';
import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { env } from '../env';
import { drawQuestion as drawFromDb, listPublicCategories } from './catalog';
import { GameError, GameRoom, type DealtQuestion } from './room';
import { UsageLog } from './usage';

type SocketData = { deviceId: string; code: string | null };
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const deviceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
// Older clients don't send a platform: they are the website.
const platformSchema = z.enum(platforms).catch('web');
/** Empty rooms (everyone gone) and finished games are dropped after this long without activity. */
const IDLE_ROOM_MS = 30 * 60 * 1000;
const SWEEP_MS = 60 * 1000;

export type GameServerOptions = {
  /** Overridable in tests. */
  drawQuestion?: (categoryId: number, points: number) => Promise<DealtQuestion | null>;
};

const channel = (code: string) => `room:${code}`;

/**
 * Live game over Socket.IO. Rooms live in this process's memory, so run a single
 * server instance (or add a shared adapter + store before scaling out).
 */
export function attachGameServer(app: FastifyInstance, opts: GameServerOptions = {}) {
  const drawQuestion = opts.drawQuestion ?? drawFromDb;
  const io: GameServer = new Server(app.server, { serveClient: false, cors: { origin: env.NODE_ENV === 'production' ? env.APP_ORIGINS : true } });
  const rooms = new Map<string, GameRoom>();
  const usage = new UsageLog(app.log);

  function newCode() {
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
    } while (rooms.has(code));
    return code;
  }

  /** Every device gets its own view (hidden info differs per seat). */
  async function broadcast(room: GameRoom) {
    for (const s of await io.in(channel(room.code)).fetchSockets()) {
      const seat = room.seatOf(s.data.deviceId);
      if (seat !== null) s.emit('room:state', room.view(seat));
    }
  }

  function closeRoom(room: GameRoom, reason: string) {
    usage.ended(room);
    room.dispose();
    rooms.delete(room.code);
    io.to(channel(room.code)).emit('room:closed', reason);
    io.in(channel(room.code)).socketsLeave(channel(room.code));
  }

  function currentRoom(socket: GameSocket) {
    const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
    if (!room) throw new GameError('الغرفة غير موجودة!');
    const seat = room.seatOf(socket.data.deviceId);
    if (seat === null) throw new GameError('لست في هذه الغرفة');
    return { room, seat };
  }

  /** Is another tab of the same device still in the room? Then it stays "connected". */
  async function deviceStillHere(room: GameRoom, deviceId: string, except: string) {
    const sockets = await io.in(channel(room.code)).fetchSockets();
    return sockets.some((s) => s.id !== except && s.data.deviceId === deviceId);
  }

  async function detach(socket: GameSocket) {
    const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
    socket.data.code = null;
    if (!room) return;
    await socket.leave(channel(room.code));
    if (await deviceStillHere(room, socket.data.deviceId, socket.id)) return;
    room.setConnected(socket.data.deviceId, false);
    await broadcast(room);
  }

  async function enter(socket: GameSocket, room: GameRoom) {
    if (socket.data.code && socket.data.code !== room.code) await detach(socket);
    socket.data.code = room.code;
    await socket.join(channel(room.code));
    await broadcast(room);
  }

  /** Wraps a handler: validates input, turns GameError/ZodError into `{ok:false}`, broadcasts on success. */
  function handle<I, T>(schema: z.ZodType<I> | null, fn: (input: I) => Promise<{ data: T; room?: GameRoom }>) {
    return async (...args: unknown[]) => {
      const reply = args.at(-1) as ((res: Ack<T>) => void) | undefined;
      if (typeof reply !== 'function') return;
      try {
        const parsed = schema ? schema.safeParse(args[0]) : { success: true as const, data: undefined as I };
        if (!parsed.success) return reply({ ok: false, error: parsed.error.issues[0]?.message ?? 'طلب غير صالح' });
        const { data, room } = await fn(parsed.data);
        reply({ ok: true, data });
        if (room) await broadcast(room);
      } catch (err) {
        if (err instanceof GameError) return reply({ ok: false, error: err.message });
        app.log.error(err);
        reply({ ok: false, error: 'حدث خطأ، حاول مرة ثانية' });
      }
    };
  }

  io.use((socket, next) => {
    const parsed = deviceIdSchema.safeParse(socket.handshake.auth?.deviceId);
    if (!parsed.success) return next(new Error('missing device id'));
    socket.data.deviceId = parsed.data;
    socket.data.code = null;
    usage.visit(parsed.data, platformSchema.parse(socket.handshake.auth?.platform));
    next();
  });

  io.on('connection', (socket) => {
    const { deviceId } = socket.data;

    socket.on(
      'room:create',
      handle(createRoomInput, async (input) => {
        const code = newCode();
        const room = new GameRoom(code, input.mode, input.variant, () => void broadcast(room));
        room.seatHost(deviceId, input.teamName);
        rooms.set(code, room);
        usage.created(room);
        await enter(socket, room);
        return { data: { code } };
      }),
    );

    socket.on(
      'room:join',
      handle(joinRoomInput, async ({ code, teamName }) => {
        const room = rooms.get(code);
        if (!room) throw new GameError('الغرفة غير موجودة!');
        room.join(deviceId, teamName);
        await enter(socket, room);
        return { data: { code } };
      }),
    );

    socket.on(
      'room:leave',
      handle(null, async () => {
        const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
        if (!room) return { data: null };
        const closes = room.leave(deviceId);
        socket.data.code = null;
        await socket.leave(channel(room.code));
        if (closes) closeRoom(room, 'المضيف أغلق الغرفة');
        return { data: null, room: closes ? undefined : room };
      }),
    );

    socket.on(
      'game:start',
      handle(startGameInput, async ({ categoryIds }) => {
        const { room, seat } = currentRoom(socket);
        const found = await listPublicCategories(categoryIds);
        if (found.length !== categoryIds.length) throw new GameError('فئة غير موجودة');
        const notReady = found.find((c) => !c.playable);
        if (notReady) throw new GameError(`فئة «${notReady.name}» ليس فيها أسئلة كافية`);
        // Keep the order the host picked them in.
        const byId = new Map(found.map((c) => [c.id, { id: c.id, name: c.name, icon: c.icon }]));
        room.start(seat, categoryIds.map((id) => byId.get(id)!));
        usage.started(room);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:pick',
      handle(pickCellInput, async ({ categoryId, points }) => {
        const { room, seat } = currentRoom(socket);
        room.assertCanPick(seat, categoryId, points);
        room.picking = true;
        try {
          const question = await drawQuestion(categoryId, points);
          if (!question) throw new GameError('لا يوجد سؤال مفعّل لهذه الخانة');
          room.beginRound(categoryId, points, question);
        } finally {
          room.picking = false;
        }
        return { data: null, room };
      }),
    );

    socket.on(
      'game:action',
      handle(actionInput, async ({ action }) => {
        const { room, seat } = currentRoom(socket);
        room.act(seat, action);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:answer',
      handle(answerInput, async ({ index }) => {
        const { room, seat } = currentRoom(socket);
        room.answer(seat, index);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:next',
      handle(null, async () => {
        const { room, seat } = currentRoom(socket);
        room.next(seat);
        if (room.status === 'done') usage.ended(room);
        return { data: null, room };
      }),
    );

    socket.on('disconnect', () => {
      usage.left(deviceId);
      void detach(socket);
    });
  });

  const sweeper = setInterval(() => {
    const cutoff = Date.now() - IDLE_ROOM_MS;
    for (const room of rooms.values()) {
      if (room.lastActivity < cutoff && (!room.hasConnectedDevice || room.status === 'done')) closeRoom(room, 'انتهت مدة الغرفة');
    }
  }, SWEEP_MS);
  sweeper.unref();

  /** Snapshot for the admin dashboard. */
  function live(): LiveStats {
    const devices = new Set([...io.sockets.sockets.values()].map((s) => s.data.deviceId));
    let playersInRooms = 0;
    const list = [...rooms.values()]
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .map((room) => {
        playersInRooms += room.teams.filter((t) => t?.connected).length + (room.tv?.connected ? 1 : 0);
        return {
          code: room.code,
          mode: room.mode,
          variant: room.variant,
          status: room.status,
          phase: room.phase,
          teams: room.teams.map((t) => (t ? { name: t.name, score: t.score, connected: t.connected } : null)),
          tvConnected: room.mode === 'tv' ? Boolean(room.tv?.connected) : null,
          categories: room.categories.map((c) => c.name),
          roundsPlayed: room.used.size,
          totalRounds: room.categories.length * POINTS.length,
          idleSeconds: Math.round((Date.now() - room.lastActivity) / 1000),
        };
      });
    return { connections: io.engine.clientsCount, devicesOnline: devices.size, playersInRooms, rooms: list };
  }

  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    for (const room of rooms.values()) {
      usage.ended(room);
      room.dispose();
    }
    await usage.flush();
    // Fastify closes the HTTP server itself; only drop the live connections here.
    io.disconnectSockets(true);
    io.engine.close();
  });

  return { io, rooms, live };
}

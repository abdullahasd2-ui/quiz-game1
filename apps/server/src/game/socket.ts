import { randomInt } from 'node:crypto';
import {
  actionInput,
  platforms,
  answerInput,
  createRoomInput,
  hideInput,
  HINT_QUESTION_POINTS,
  joinRoomInput,
  kickInput,
  listAnswerInput,
  listPickInput,
  MAX_BOARD_CATEGORIES,
  MIN_BOARD_CATEGORIES,
  pickCellInput,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  startGameInput,
  voteInput,
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
import { SoloRoom } from './solo';

type AnyRoom = GameRoom | SoloRoom;
const SOLO_ONLY_TEAMS = 'هذا الخيار للعب بفريقين فقط';
import { LIST_CATEGORIES, listBank, weightedPick } from '../kick/lists/bank';
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
  const rooms = new Map<string, AnyRoom>();
  const usage = new UsageLog(app.log);

  function newCode() {
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
    } while (rooms.has(code));
    return code;
  }

  /** Every device gets its own view (hidden info differs per seat). */
  async function broadcast(room: AnyRoom) {
    for (const s of await io.in(channel(room.code)).fetchSockets()) {
      if (room instanceof SoloRoom) {
        const seat = room.seatOf(s.data.deviceId);
        if (seat !== null) s.emit('room:solo', room.view(seat));
        continue;
      }
      const viewer = room.viewerOf(s.data.deviceId);
      if (viewer) s.emit('room:state', room.view(viewer.seat, viewer.member));
    }
  }

  function closeRoom(room: AnyRoom, reason: string) {
    usage.ended(room);
    room.dispose();
    rooms.delete(room.code);
    io.to(channel(room.code)).emit('room:closed', reason);
    io.in(channel(room.code)).socketsLeave(channel(room.code));
  }

  /** A solo room and the player id (or 'tv') of this device, or null when the room has teams. */
  function soloRoom(socket: GameSocket) {
    const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
    if (!(room instanceof SoloRoom)) return null;
    const seat = room.seatOf(socket.data.deviceId);
    if (seat === null) throw new GameError('لست في هذه الغرفة');
    return { room, seat };
  }

  function currentRoom(socket: GameSocket) {
    const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
    if (!room) throw new GameError('الغرفة غير موجودة!');
    if (room instanceof SoloRoom) throw new GameError(SOLO_ONLY_TEAMS);
    const seat = room.seatOf(socket.data.deviceId);
    if (seat === null) {
      if (room.memberOf(socket.data.deviceId) !== null) throw new GameError('رئيس الفريق هو اللي يقرر — صوّت له!');
      throw new GameError('لست في هذه الغرفة');
    }
    return { room, seat };
  }

  /** Is another tab of the same device still in the room? Then it stays "connected". */
  async function deviceStillHere(room: AnyRoom, deviceId: string, except: string) {
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

  async function enter(socket: GameSocket, room: AnyRoom) {
    if (socket.data.code && socket.data.code !== room.code) await detach(socket);
    socket.data.code = room.code;
    await socket.join(channel(room.code));
    await broadcast(room);
  }

  /** Wraps a handler: validates input, turns GameError/ZodError into `{ok:false}`, broadcasts on success. */
  function handle<I, T>(schema: z.ZodType<I> | null, fn: (input: I) => Promise<{ data: T; room?: AnyRoom }>) {
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
        let room: AnyRoom;
        if (input.solo) {
          if (input.variant === 'hide') throw new GameError('«خبّي أو اكشف» للعب بفريقين فقط');
          const solo = new SoloRoom(code, input.mode, input.variant, () => void broadcast(solo));
          solo.seatHost(deviceId, input.playerName);
          room = solo;
        } else {
          const teams = new GameRoom(code, input.mode, input.variant, () => void broadcast(teams));
          teams.seatHost(deviceId, input.teamName, input.playerName);
          room = teams;
        }
        rooms.set(code, room);
        usage.created(room);
        await enter(socket, room);
        return { data: { code } };
      }),
    );

    socket.on(
      'room:join',
      handle(joinRoomInput, async ({ code, teamName, team, playerName }) => {
        const room = rooms.get(code);
        if (!room) throw new GameError('الغرفة غير موجودة!');
        if (room instanceof SoloRoom) room.join(deviceId, playerName);
        else room.join(deviceId, teamName, team, playerName);
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
      'room:kick',
      handle(kickInput, async ({ id }) => {
        const solo = soloRoom(socket);
        const { room, seat } = solo ?? currentRoom(socket);
        const removed = solo ? solo.room.kick(solo.seat, id) : (room as GameRoom).kick(seat as never, id);
        // Every tab of the removed device is told and pulled out of the room's channel.
        for (const s of await io.in(channel(room.code)).fetchSockets()) {
          if (s.data.deviceId !== removed) continue;
          s.emit('room:closed', 'طردك مضيف الغرفة');
          s.data.code = null;
          s.leave(channel(room.code));
        }
        return { data: null, room };
      }),
    );

    socket.on(
      'game:start',
      handle(startGameInput, async ({ categoryIds, actionSeconds, listCategories }) => {
        const solo = soloRoom(socket);
        const { room, seat } = solo ?? currentRoom(socket);
        if (room.variant === 'list') {
          // «عدّها»: the list categories (football, geo… «حروف»), no board.
          const cats = LIST_CATEGORIES.filter((c) => listCategories?.includes(c.id)).map(({ id, name, icon }) => ({ id, name, icon }));
          if (!cats.length) throw new GameError('اختر فئة وحدة على الأقل');
          if (room instanceof SoloRoom) room.start(seat as string, [], actionSeconds, cats);
          else room.start(seat as never, [], actionSeconds, cats);
          usage.started(room);
          return { data: null, room };
        }
        if (categoryIds.length < MIN_BOARD_CATEGORIES) throw new GameError(`اختر ${MIN_BOARD_CATEGORIES} فئات على الأقل`);
        if (categoryIds.length > MAX_BOARD_CATEGORIES) throw new GameError(`اختر ${MAX_BOARD_CATEGORIES} فئات كحد أقصى`);
        const found = await listPublicCategories(categoryIds);
        if (found.length !== categoryIds.length) throw new GameError('فئة غير موجودة');
        const notReady = found.find((c) => !c.playable);
        if (notReady) throw new GameError(`فئة «${notReady.name}» ليس فيها أسئلة كافية`);
        // Keep the order the host picked them in.
        const byId = new Map(found.map((c) => [c.id, { id: c.id, name: c.name, icon: c.icon }]));
        if (room instanceof SoloRoom) room.start(seat as string, categoryIds.map((id) => byId.get(id)!), actionSeconds);
        else room.start(seat as never, categoryIds.map((id) => byId.get(id)!), actionSeconds);
        usage.started(room);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:pick',
      handle(pickCellInput, async ({ categoryId, points }) => {
        const solo = soloRoom(socket);
        const { room, seat } = solo ?? currentRoom(socket);
        if (room instanceof SoloRoom) room.assertCanPick(seat as string, categoryId, points);
        else room.assertCanPick(seat as never, categoryId, points);
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
      handle(actionInput, async ({ action, target }) => {
        const solo = soloRoom(socket);
        if (solo) {
          solo.room.act(solo.seat, action, target);
          return { data: null, room: solo.room };
        }
        const { room, seat } = currentRoom(socket);
        room.act(seat, action);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:answer',
      handle(answerInput, async ({ index }) => {
        const solo = soloRoom(socket);
        if (solo) {
          solo.room.answer(solo.seat, index);
          return { data: null, room: solo.room };
        }
        const { room, seat } = currentRoom(socket);
        room.answer(seat, index);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:hide',
      handle(hideInput, async ({ box }) => {
        const { room, seat } = currentRoom(socket);
        room.hideIn(seat, box);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:guess',
      handle(hideInput, async ({ box }) => {
        const { room, seat } = currentRoom(socket);
        room.guess(seat, box);
        return { data: null, room };
      }),
    );

    // «عدّها»: the team in turn picks a category; a random easy or medium question from it that this room has not played.
    socket.on(
      'game:listPick',
      handle(listPickInput, async ({ category }) => {
        const solo = soloRoom(socket);
        const { room, seat } = solo ?? currentRoom(socket);
        if (room instanceof SoloRoom) room.assertCanListPick(seat as string, category);
        else room.assertCanListPick(seat as never, category);
        const pool = listBank().filter(
          (q) => q.level !== 'hard' && !room.listUsed.has(q.id) && (category === 'letters' ? Boolean(q.letter) : q.cat === category),
        );
        // Saudi, Gulf and Arab topics (and easy questions) come up more often.
        const q = weightedPick(pool);
        if (!q) throw new GameError('خلصت أسئلة هذي الفئة — اختر فئة ثانية');
        const name = LIST_CATEGORIES.find((c) => c.id === category);
        room.beginList({ id: q.id, text: q.text, answers: q.answers, letter: q.letter, category: name ? `${name.icon} ${name.name}` : category });
        return { data: null, room };
      }),
    );

    socket.on(
      'game:listAnswer',
      handle(listAnswerInput, async ({ text }) => {
        // Unlike every other step, members type their own answers here: their team is their seat.
        const solo = soloRoom(socket);
        if (solo) {
          const added = solo.room.listAnswer(solo.seat, text);
          return { data: { added }, room: added.length ? solo.room : undefined };
        }
        const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
        if (!room || room instanceof SoloRoom) throw new GameError('الغرفة غير موجودة!');
        const seat = room.seatOf(socket.data.deviceId) ?? room.memberOf(socket.data.deviceId);
        if (seat === null) throw new GameError('لست في هذه الغرفة');
        const added = room.listAnswer(seat, text);
        // Only a new right answer changes what the room shows.
        return { data: { added }, room: added.length ? room : undefined };
      }),
    );

    socket.on(
      'game:hint',
      handle(null, async () => {
        const { room, seat } = currentRoom(socket);
        room.assertCanHint(seat);
        room.picking = true;
        try {
          // A medium question from one of the room's categories; try the others if one has none.
          for (const categoryId of room.hintCategoryOrder()) {
            const question = await drawQuestion(categoryId, HINT_QUESTION_POINTS);
            if (question) {
              room.beginHint(categoryId, question);
              return { data: null, room };
            }
          }
          throw new GameError('ما لقيت سؤال للتلميح');
        } finally {
          room.picking = false;
        }
      }),
    );

    socket.on(
      'game:vote',
      handle(voteInput, async ({ key }) => {
        const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
        if (!room) throw new GameError('الغرفة غير موجودة!');
        if (room instanceof SoloRoom) throw new GameError(SOLO_ONLY_TEAMS);
        room.vote(deviceId, key);
        return { data: null, room };
      }),
    );

    socket.on(
      'game:next',
      handle(null, async () => {
        const solo = soloRoom(socket);
        const { room, seat } = solo ?? currentRoom(socket);
        if (room instanceof SoloRoom) room.next(seat as string);
        else room.next(seat as never);
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
        playersInRooms += room.connectedCount;
        return {
          code: room.code,
          mode: room.mode,
          variant: room.variant,
          status: room.status,
          phase: room.phase,
          teams:
            room instanceof SoloRoom
              ? room.players.map((p) => ({ id: p.pid, name: p.name, score: p.score, connected: p.connected }))
              : room.teams.map((t, i) => (t ? { id: String(i), name: t.name, score: t.score, connected: t.connected } : null)),
          solo: room instanceof SoloRoom,
          tvConnected: room.mode === 'tv' ? Boolean(room.tv?.connected) : null,
          categories: room.categories.map((c) => c.name),
          roundsPlayed: room.roundsPlayed,
          totalRounds: room.totalRounds,
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

  /** The admin dashboard changes a score in a live room; every device in it sees the new score. */
  async function adminScore(code: string, id: string, delta: number) {
    const room = rooms.get(code);
    if (!room) throw new GameError('الغرفة غير موجودة!');
    room.adminAdjust(id, delta);
    await broadcast(room);
  }

  return { io, rooms, live, adminScore };
}

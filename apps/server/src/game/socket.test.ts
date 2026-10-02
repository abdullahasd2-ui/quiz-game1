import type { Ack, ClientToServerEvents, RoomView, ServerToClientEvents } from '@quiz/shared';
import type { FastifyInstance } from 'fastify';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { db, sqlClient } from '../db/client';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { admins, categories, games, questions } from '../db/schema';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: FastifyInstance;
let url: string;
let catIds: number[];
const clients: Client[] = [];

/** A device: a socket plus the latest room view it received. */
async function device(deviceId: string, platform?: string) {
  const socket: Client = connect(url, { auth: { deviceId, platform }, transports: ['websocket'], forceNew: true });
  clients.push(socket);
  const d = { socket, view: null as RoomView | null, closed: null as string | null };
  socket.on('room:state', (v) => (d.view = v));
  socket.on('room:closed', (r) => (d.closed = r));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return d;
}

// Emits and resolves with the ack (typed loosely: tests also send invalid payloads).
function call<T = null>(socket: Client, event: string, ...args: unknown[]): Promise<Ack<T>> {
  return (socket.emitWithAck as (e: string, ...a: unknown[]) => Promise<Ack<T>>)(event, ...args);
}

async function until(check: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting for state');
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeAll(async () => {
  await sqlClient`truncate questions, categories restart identity cascade`;
  const cats = await db
    .insert(categories)
    .values([
      { slug: 'a', name: 'أ', icon: '🅰️', sortOrder: 1 },
      { slug: 'b', name: 'ب', icon: '🅱️', sortOrder: 2 },
      { slug: 'c', name: 'ج', icon: '©️', sortOrder: 3 },
      { slug: 'thin', name: 'ناقصة', icon: '❔', sortOrder: 4 },
    ])
    .returning({ id: categories.id });
  catIds = cats.map((c) => c.id);
  const rows = catIds.slice(0, 3).flatMap((categoryId) =>
    [100, 200, 300, 400, 500].map((points) => ({
      categoryId,
      text: `سؤال ${categoryId}-${points}`,
      options: ['صح', 'غلط 1', 'غلط 2', 'غلط 3'],
      correctIndex: 0,
      points,
    })),
  );
  rows.push({ categoryId: catIds[3]!, text: 'وحيد', options: ['صح', 'x', 'y', 'z'], correctIndex: 0, points: 100 });
  await db.insert(questions).values(rows);

  app = await buildApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterEach(() => {
  for (const c of clients.splice(0)) c.disconnect();
});

afterAll(async () => {
  await app.close();
});

async function startedMobileGame() {
  const host = await device('device-host-1');
  const guest = await device('device-guest-1');
  const created = await call<{ code: string }>(host.socket, 'room:create', { mode: 'mobile', variant: 'swap', teamName: 'النمور' });
  if (!created.ok) throw new Error(created.error);
  const code = created.data.code;
  expect(await call(guest.socket, 'room:join', { code: code.toLowerCase(), teamName: 'الصقور' })).toEqual({ ok: true, data: { code } });
  expect(await call(host.socket, 'game:start', { categoryIds: catIds.slice(0, 3) })).toEqual({ ok: true, data: null });
  await until(() => guest.view?.status === 'playing');
  return { host, guest, code };
}

describe('live game over sockets', () => {
  it('rejects connections without a device id', async () => {
    const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    const err = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(err.message).toBe('missing device id');
  });

  it('validates payloads and room rules with Arabic errors', async () => {
    const host = await device('device-host-2');
    expect(await call(host.socket, 'room:join', { code: 'ABC' })).toEqual({ ok: false, error: 'الكود 6 أحرف' });
    expect(await call(host.socket, 'room:join', { code: 'ZZZZZZ' })).toEqual({ ok: false, error: 'الغرفة غير موجودة!' });
    const created = await call<{ code: string }>(host.socket, 'room:create', { mode: 'mobile', variant: 'flip' });
    expect(created.ok).toBe(true);
    expect(await call(host.socket, 'game:start', { categoryIds: catIds.slice(0, 3) })).toEqual({ ok: false, error: 'في انتظار الفريق الثاني' });
    const guest = await device('device-guest-2');
    await call(guest.socket, 'room:join', { code: created.ok ? created.data.code : '' });
    expect(await call(host.socket, 'game:start', { categoryIds: catIds.slice(0, 2) })).toEqual({ ok: false, error: 'اختر 3 فئات على الأقل' });
    expect(await call(host.socket, 'game:start', { categoryIds: [catIds[0], catIds[1], catIds[3]] })).toEqual({
      ok: false,
      error: 'فئة «ناقصة» ليس فيها أسئلة كافية',
    });
    expect(await call(guest.socket, 'game:start', { categoryIds: catIds.slice(0, 3) })).toEqual({ ok: false, error: 'المضيف فقط يبدأ اللعبة' });
  });

  it('plays a full round: secret choices, shuffled options, scores', async () => {
    const { host, guest } = await startedMobileGame();
    expect(guest.view!.categories.map((c) => c.name)).toEqual(['أ', 'ب', 'ج']);
    expect(await call(guest.socket, 'game:pick', { categoryId: catIds[0], points: 300 })).toEqual({ ok: false, error: 'ليس دورك!' });
    expect(await call(host.socket, 'game:pick', { categoryId: catIds[0], points: 300 })).toEqual({ ok: true, data: null });
    await until(() => guest.view?.phase === 'action');
    const q = guest.view!.question!;
    expect(q.text).toBe(`سؤال ${catIds[0]}-300`);
    expect(q.options.slice().sort()).toEqual(['صح', 'غلط 1', 'غلط 2', 'غلط 3'].slice().sort());
    expect(JSON.stringify(guest.view)).not.toContain('correctIndex');

    await call(host.socket, 'game:action', { action: 'answer' });
    await until(() => guest.view!.decided[0]);
    expect(guest.view!.myAction).toBeNull();
    await call(guest.socket, 'game:action', { action: 'steal' });
    await until(() => host.view?.phase === 'answer');
    expect(host.view!.myAction).toBe('answer');
    expect(guest.view!.myAnswer).toBe(-1);
    expect(await call(guest.socket, 'game:answer', { index: 0 })).toEqual({ ok: false, error: 'جوابك محفوظ بالفعل' });

    await call(host.socket, 'game:answer', { index: q.options.indexOf('صح') });
    await until(() => guest.view?.phase === 'result');
    expect(guest.view!.result).toMatchObject({ correctIndex: q.options.indexOf('صح'), actions: ['answer', 'steal'], deltas: [0, 600] });
    expect(guest.view!.teams.map((t) => t?.score)).toEqual([0, 600]);

    await call(guest.socket, 'game:next');
    await until(() => host.view?.phase === 'board');
    expect(host.view!.turn).toBe(1);
    expect(host.view!.used).toEqual([`${catIds[0]}:300`]);
  });

  it('a refreshed device rejoins its seat with the code', async () => {
    const { guest, host, code } = await startedMobileGame();
    guest.socket.disconnect();
    await until(() => host.view?.teams[1]?.connected === false);
    const again = await device('device-guest-1');
    expect(await call(again.socket, 'room:join', { code })).toEqual({ ok: true, data: { code } });
    await until(() => again.view?.you === 1 && host.view?.teams[1]?.connected === true);
    expect(again.view!.teams[1]!.name).toBe('الصقور');
  });

  it('the host leaving the lobby closes the room for everyone', async () => {
    const host = await device('device-host-3');
    const guest = await device('device-guest-3');
    const created = await call<{ code: string }>(host.socket, 'room:create', { mode: 'tv', variant: 'swap' });
    await call(guest.socket, 'room:join', { code: created.ok ? created.data.code : '' });
    await until(() => guest.view?.you === 0);
    await call(host.socket, 'room:leave');
    await until(() => guest.closed !== null);
    expect(guest.closed).toBe('المضيف أغلق الغرفة');
    expect(await call(guest.socket, 'game:next')).toEqual({ ok: false, error: 'الغرفة غير موجودة!' });
  });

  it('records visits and games, and shows live rooms to admins', async () => {
    await sqlClient`truncate daily_visits, games restart identity`;
    await db.insert(admins).values({ email: 'live@test.dev', passwordHash: await bcrypt.hash('live-password', 4) }).onConflictDoNothing();
    const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'live@test.dev', password: 'live-password' } });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;

    const host = await device('device-host-4', 'ios');
    const guest = await device('device-guest-4', 'not-a-platform');
    const created = await call<{ code: string }>(host.socket, 'room:create', { mode: 'mobile', variant: 'flip', teamName: 'النمور' });
    const code = created.ok ? created.data.code : '';
    await call(guest.socket, 'room:join', { code, teamName: 'الصقور' });
    await call(host.socket, 'game:start', { categoryIds: catIds.slice(0, 3) });
    await until(() => guest.view?.status === 'playing');

    const live = (await app.inject({ method: 'GET', url: '/api/admin/stats/live', headers: { cookie } })).json();
    expect(live).toMatchObject({ devicesOnline: 2, playersInRooms: 2 });
    expect(live.rooms.find((r: { code: string }) => r.code === code)).toMatchObject({
      mode: 'mobile', variant: 'flip', status: 'playing', categories: ['أ', 'ب', 'ج'], roundsPlayed: 0, totalRounds: 15,
      teams: [{ name: 'النمور', score: 0, connected: true }, { name: 'الصقور', score: 0, connected: true }],
    });

    const visits = await sqlClient<{ device_id: string; platform: string }[]>`select device_id, platform from daily_visits order by device_id`;
    expect(visits).toEqual([{ device_id: 'device-guest-4', platform: 'web' }, { device_id: 'device-host-4', platform: 'ios' }]);

    // Stats are written in the background.
    const gameRow = async (c: string) => (await db.select().from(games).where(eq(games.code, c)))[0];
    await expect.poll(async () => (await gameRow(code))?.startedAt ?? null).not.toBeNull();
    expect(await gameRow(code)).toMatchObject({ mode: 'mobile', variant: 'flip', categoryIds: catIds.slice(0, 3), finishedAt: null, abandonedAt: null });

    // A room closed before its last round counts as abandoned.
    const other = await call<{ code: string }>(guest.socket, 'room:create', { mode: 'tv', variant: 'swap' });
    const otherCode = other.ok ? other.data.code : '';
    await call(guest.socket, 'room:leave');
    await expect.poll(async () => (await gameRow(otherCode))?.abandonedAt ?? null).not.toBeNull();
    expect(await gameRow(otherCode)).toMatchObject({ startedAt: null, finishedAt: null, roundsPlayed: 0, scores: [0, 0] });
  });
});

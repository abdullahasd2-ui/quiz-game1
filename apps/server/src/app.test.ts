import { mkdir } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { db, sqlClient } from './db/client';
import { admins } from './db/schema';

let app: FastifyInstance;
let cookie: string;

const validQuestion = (categoryId: number, extra: Record<string, unknown> = {}) => ({
  categoryId,
  text: 'ما هي عاصمة أستراليا؟',
  options: ['سيدني', 'ملبورن', 'كانبيرا', 'بريسبان'],
  correctIndex: 2,
  points: 100,
  ...extra,
});

async function createCategory(slug = 'geo') {
  const res = await app.inject({ method: 'POST', url: '/api/admin/categories', headers: { cookie }, payload: { slug, name: 'جغرافيا', icon: '🗺️' } });
  expect(res.statusCode).toBe(201);
  return res.json().id as number;
}

beforeAll(async () => {
  await mkdir('./.test-uploads', { recursive: true });
  app = await buildApp();
  await db.insert(admins).values({ email: 'admin@test.dev', passwordHash: await bcrypt.hash('correct-horse', 4) });
  const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'ADMIN@test.dev', password: 'correct-horse' } });
  expect(res.statusCode).toBe(200);
  const setCookie = res.headers['set-cookie'];
  cookie = String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0]!;
});

beforeEach(async () => {
  await sqlClient`truncate questions, categories restart identity cascade`;
});

afterAll(async () => {
  await app.close();
  await sqlClient.end();
});

describe('auth', () => {
  it('rejects admin routes without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/questions' });
    expect(res.statusCode).toBe(401);
  });
  it('rejects a wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { email: 'admin@test.dev', password: 'nope' } });
    expect(res.statusCode).toBe(401);
  });
  it('returns the current admin', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie } });
    expect(res.json()).toMatchObject({ email: 'admin@test.dev' });
  });
});

describe('questions', () => {
  it('creates, lists, filters and searches', async () => {
    const geo = await createCategory();
    await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo) });
    await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo, { text: 'أطول نهر؟', points: 200, active: false }) });

    const all = await app.inject({ method: 'GET', url: '/api/admin/questions', headers: { cookie } });
    expect(all.json().total).toBe(2);
    const active = await app.inject({ method: 'GET', url: '/api/admin/questions?active=true', headers: { cookie } });
    expect(active.json().items.map((q: { points: number }) => q.points)).toEqual([100]);
    const search = await app.inject({ method: 'GET', url: `/api/admin/questions?search=${encodeURIComponent('نهر')}`, headers: { cookie } });
    expect(search.json().total).toBe(1);
  });

  it('validates input', async () => {
    const geo = await createCategory();
    const bad = await app.inject({
      method: 'POST', url: '/api/admin/questions', headers: { cookie },
      payload: validQuestion(geo, { options: ['a', 'a', 'b', 'c'], points: 150, correctIndex: 4 }),
    });
    expect(bad.statusCode).toBe(400);
    const paths = bad.json().issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['points', 'correctIndex']));

    const noImage = await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo, { type: 'image' }) });
    expect(noImage.statusCode).toBe(400);
  });

  it('refuses to activate a legacy canvas-drawn question until it has a real image', async () => {
    const brands = await createCategory('brands');
    const legacy = validQuestion(brands, { type: 'image', imageUrl: 'legacy-draw:brand_lv', active: false });
    const created = (await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: legacy })).json();
    const activate = await app.inject({ method: 'PATCH', url: `/api/admin/questions/${created.id}`, headers: { cookie }, payload: { active: true } });
    expect(activate.statusCode).toBe(400);
    const fixed = await app.inject({ method: 'PATCH', url: `/api/admin/questions/${created.id}`, headers: { cookie }, payload: { active: true, imageUrl: '/uploads/lv.png' } });
    expect(fixed.json()).toMatchObject({ active: true, imageUrl: '/uploads/lv.png' });
  });

  it('patches by merging onto the stored question and re-validating', async () => {
    const geo = await createCategory();
    const created = (await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo) })).json();
    const ok = await app.inject({ method: 'PATCH', url: `/api/admin/questions/${created.id}`, headers: { cookie }, payload: { correctIndex: 1 } });
    expect(ok.json()).toMatchObject({ correctIndex: 1, text: created.text });
    const bad = await app.inject({ method: 'PATCH', url: `/api/admin/questions/${created.id}`, headers: { cookie }, payload: { type: 'zoom' } });
    expect(bad.statusCode).toBe(400);
  });

  it('imports all-or-nothing', async () => {
    await createCategory('geo');
    const good = { categorySlug: 'geo', text: 'س', options: ['1', '2', '3', '4'], correctIndex: 0, points: 300 };
    const bad = await app.inject({ method: 'POST', url: '/api/admin/questions/import', headers: { cookie }, payload: { questions: [good, { ...good, categorySlug: 'nope' }] } });
    expect(bad.statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/admin/questions', headers: { cookie } })).json().total).toBe(0);

    const ok = await app.inject({ method: 'POST', url: '/api/admin/questions/import', headers: { cookie }, payload: { questions: [good, good] } });
    expect(ok.json()).toEqual({ inserted: 2, skipped: 0 });
  });
});

describe('question bank', () => {
  const proposal = (extra: Record<string, unknown> = {}) => ({
    categorySlug: 'geo', text: 'ما هي عاصمة أستراليا؟', options: ['سيدني', 'ملبورن', 'كانبيرا', 'بريسبان'], correctIndex: 2, points: 100, reference: 'https://example.org', ...extra,
  });
  const list = (query: string) => app.inject({ method: 'GET', url: `/api/admin/questions?${query}`, headers: { cookie } }).then((r) => r.json());
  const propose = (questions: unknown[]) =>
    app.inject({ method: 'POST', url: '/api/admin/questions/import', headers: { cookie }, payload: { questions, status: 'pending', source: 'codex' } });

  it('keeps proposals out of the question list and the game until approved', async () => {
    const geo = await createCategory();
    for (const points of [100, 200, 300, 400]) {
      await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo, { points, text: `سؤال ${points}` }) });
    }
    const res = await propose([proposal({ points: 500 })]);
    expect(res.json()).toEqual({ inserted: 1, skipped: 0 });

    expect((await list('')).total).toBe(4);
    const pending = await list('status=pending');
    expect(pending.items[0]).toMatchObject({ status: 'pending', source: 'codex', reference: 'https://example.org', points: 500 });
    expect((await app.inject({ method: 'GET', url: '/api/categories' })).json()[0].playable).toBe(false);

    const review = await app.inject({ method: 'POST', url: '/api/admin/questions/review', headers: { cookie }, payload: { ids: [pending.items[0].id], status: 'approved' } });
    expect(review.json()).toEqual({ updated: 1 });
    expect((await list('status=pending')).total).toBe(0);
    expect((await app.inject({ method: 'GET', url: '/api/categories' })).json()[0].playable).toBe(true);
  });

  it('skips proposals whose text already exists in the category, ignoring diacritics and punctuation', async () => {
    await createCategory('geo');
    await createCategory('history');
    expect((await propose([proposal()])).json()).toEqual({ inserted: 1, skipped: 0 });
    const [first] = (await list('status=pending')).items;
    await app.inject({ method: 'POST', url: '/api/admin/questions/review', headers: { cookie }, payload: { ids: [first.id], status: 'rejected' } });

    const again = await propose([
      proposal({ text: 'ما هِيَ عاصمةُ  أستراليا ؟' }),
      proposal({ text: 'ما هي عاصمة أستراليا', categorySlug: 'history' }),
      proposal({ text: 'ما عاصمة كندا؟' }),
      proposal({ text: 'ما عاصمة كندا' }),
    ]);
    expect(again.json()).toEqual({ inserted: 2, skipped: 2 });
    expect((await list('status=rejected')).total).toBe(1);
  });

  it('filters proposals by points and rejects an invalid review', async () => {
    await createCategory('geo');
    await propose([proposal(), proposal({ text: 'ما عاصمة كندا؟', points: 300 })]);
    expect((await list('status=pending&points=300')).items.map((q: { text: string }) => q.text)).toEqual(['ما عاصمة كندا؟']);
    const bad = await app.inject({ method: 'POST', url: '/api/admin/questions/review', headers: { cookie }, payload: { ids: [], status: 'approved' } });
    expect(bad.statusCode).toBe(400);
  });
});

describe('categories', () => {
  it('refuses duplicate slugs and deleting a category with questions', async () => {
    const geo = await createCategory();
    const dup = await app.inject({ method: 'POST', url: '/api/admin/categories', headers: { cookie }, payload: { slug: 'geo', name: 'x', icon: 'x' } });
    expect(dup.statusCode).toBe(409);
    await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo) });
    const del = await app.inject({ method: 'DELETE', url: `/api/admin/categories/${geo}`, headers: { cookie } });
    expect(del.statusCode).toBe(409);
  });

  it('public list marks a category playable only when every points level has an active question', async () => {
    const geo = await createCategory();
    for (const points of [100, 200, 300, 400]) {
      await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo, { points }) });
    }
    const before = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(before.json()[0]).toMatchObject({ slug: 'geo', playable: false });
    await app.inject({ method: 'POST', url: '/api/admin/questions', headers: { cookie }, payload: validQuestion(geo, { points: 500 }) });
    const after = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(after.json()[0]).toMatchObject({ slug: 'geo', playable: true });
    expect(after.json()[0]).not.toHaveProperty('levels');
  });
});

describe('upload', () => {
  const multipart = (mime: string, body: Buffer) => {
    const boundary = '----test';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x"\r\nContent-Type: ${mime}\r\n\r\n`),
      body,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return { headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload };
  };

  it('stores an image and serves it back', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const res = await app.inject({ method: 'POST', url: '/api/admin/upload', ...multipart('image/png', png) });
    expect(res.statusCode).toBe(201);
    const served = await app.inject({ method: 'GET', url: res.json().url });
    expect(served.statusCode).toBe(200);
  });

  it('rejects non-images', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/upload', ...multipart('text/html', Buffer.from('<script>')) });
    expect(res.statusCode).toBe(415);
  });
});

describe('admin accounts', () => {
  const login = async (email: string, password: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { email, password } });
    if (res.statusCode !== 200) return null;
    const setCookie = res.headers['set-cookie'];
    return String(Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0]!;
  };

  it('adds, lists, resets and removes admins', async () => {
    const short = await app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie }, payload: { email: 'two@test.dev', password: 'short' } });
    expect(short.statusCode).toBe(400);
    const created = await app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie }, payload: { email: 'Two@Test.dev', password: 'second-password' } });
    expect(created.statusCode).toBe(201);
    const two = created.json();
    expect(two).toMatchObject({ email: 'two@test.dev', lastLoginAt: null });
    expect(created.json()).not.toHaveProperty('passwordHash');
    const dup = await app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie }, payload: { email: 'two@test.dev', password: 'second-password' } });
    expect(dup.statusCode).toBe(409);

    const twoCookie = await login('two@test.dev', 'second-password');
    expect(twoCookie).not.toBeNull();
    const list = (await app.inject({ method: 'GET', url: '/api/admin/admins', headers: { cookie } })).json();
    expect(list.find((a: { id: number }) => a.id === two.id).lastLoginAt).not.toBeNull();

    await app.inject({ method: 'PUT', url: `/api/admin/admins/${two.id}/password`, headers: { cookie }, payload: { password: 'reset-password-1' } });
    expect(await login('two@test.dev', 'second-password')).toBeNull();
    expect(await login('two@test.dev', 'reset-password-1')).not.toBeNull();

    const self = await app.inject({ method: 'DELETE', url: `/api/admin/admins/${two.id}`, headers: { cookie: twoCookie! } });
    expect(self.statusCode).toBe(400);
    const removed = await app.inject({ method: 'DELETE', url: `/api/admin/admins/${two.id}`, headers: { cookie } });
    expect(removed.statusCode).toBe(204);
    // The removed admin's still-valid token stops working immediately.
    const after = await app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie: twoCookie! } });
    expect(after.statusCode).toBe(401);
  });

  it('changes your own password only with the current one', async () => {
    await app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie }, payload: { email: 'three@test.dev', password: 'third-password' } });
    const threeCookie = (await login('three@test.dev', 'third-password'))!;
    const wrong = await app.inject({ method: 'POST', url: '/api/admin/me/password', headers: { cookie: threeCookie }, payload: { currentPassword: 'nope', password: 'brand-new-password' } });
    expect(wrong.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/api/admin/me/password', headers: { cookie: threeCookie }, payload: { currentPassword: 'third-password', password: 'brand-new-password' } });
    expect(ok.statusCode).toBe(200);
    expect(await login('three@test.dev', 'brand-new-password')).not.toBeNull();
  });
});

describe('usage stats', () => {
  it('summarises visits and games', async () => {
    await sqlClient`truncate daily_visits, games restart identity`;
    const geo = await createCategory('geo');
    await sqlClient`
      insert into daily_visits (day, device_id, platform, visits) values
        ((now() at time zone 'Asia/Riyadh')::date, 'device-a', 'ios', 3),
        ((now() at time zone 'Asia/Riyadh')::date, 'device-b', 'web', 1),
        ((now() at time zone 'Asia/Riyadh')::date - 3, 'device-a', 'ios', 2),
        ((now() at time zone 'Asia/Riyadh')::date - 60, 'device-old', 'android', 1)`;
    await sqlClient`
      insert into games (code, mode, variant, category_ids, started_at, finished_at) values
        ('AAAAAA', 'mobile', 'swap', ${JSON.stringify([geo])}::jsonb, now() - interval '20 minutes', now() - interval '10 minutes'),
        ('BBBBBB', 'tv', 'flip', ${JSON.stringify([geo])}::jsonb, now() - interval '5 minutes', null),
        ('CCCCCC', 'mobile', 'swap', null, null, null)`;

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/usage?days=7', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const usage = res.json();
    expect(usage.totals).toEqual({ visitors: 2, visits: 6, newVisitors: 2, gamesCreated: 3, gamesStarted: 2, gamesFinished: 1, medianGameMinutes: 10 });
    expect(usage.today).toEqual({ visitors: 2, visits: 4, games: 3 });
    expect(usage.byDay).toHaveLength(7);
    expect(usage.byDay.at(-1)).toMatchObject({ visitors: 2, visits: 4, games: 3, finished: 1 });
    expect(usage.platforms).toEqual([{ platform: 'web', visitors: 1 }, { platform: 'ios', visitors: 1 }]);
    expect(usage.topCategories).toEqual([{ categoryId: geo, name: 'جغرافيا', games: 2 }]);

    const live = await app.inject({ method: 'GET', url: '/api/admin/stats/live', headers: { cookie } });
    expect(live.json()).toMatchObject({ connections: 0, devicesOnline: 0, playersInRooms: 0, rooms: [] });
  });
});

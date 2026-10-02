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
    expect(ok.json()).toEqual({ inserted: 2 });
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

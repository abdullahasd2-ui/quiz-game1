import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

/** Only the picture hosts the question bank links to. */
const ALLOWED = new Set(['i.imgur.com', 'imgur.com']);
const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = /^image\/(jpeg|png|gif|webp)$/;

/**
 * Question pictures hosted elsewhere, served from our own domain: fetched once, kept on disk, then served from the
 * copy (outside hosts often refuse to be embedded, or are slow or blocked on some networks).
 */
export async function imageProxyRoutes(app: FastifyInstance, opts: { dir: string }) {
  const cache = path.join(opts.dir, 'cache');
  await mkdir(cache, { recursive: true });
  app.get<{ Querystring: { u?: string } }>('/', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req, reply) => {
    let url: URL;
    try {
      url = new URL(String(req.query.u ?? ''));
    } catch {
      return reply.code(400).send({ error: 'رابط غير صالح' });
    }
    if (url.protocol !== 'https:' || !ALLOWED.has(url.hostname)) return reply.code(400).send({ error: 'مصدر غير مسموح' });
    const key = createHash('sha1').update(url.href).digest('hex');
    const file = path.join(cache, key);
    const send = (body: Buffer, type: string) => reply.header('content-type', type).header('cache-control', 'public, max-age=2592000, immutable').send(body);
    try {
      const [body, type] = await Promise.all([readFile(file), readFile(`${file}.type`, 'utf8')]);
      return send(body, type);
    } catch {
      // Not cached yet.
    }
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; JawabBadel/1.0)' }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const type = res?.headers.get('content-type')?.split(';')[0] ?? '';
    if (!res?.ok || !TYPES.test(type)) return reply.code(502).send({ error: 'تعذّر جلب الصورة' });
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) return reply.code(502).send({ error: 'الصورة كبيرة' });
    await writeFile(file, body).catch(() => {});
    await writeFile(`${file}.type`, type).catch(() => {});
    return send(body, type);
  });
}

import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { env } from '../../env';
import { HttpError } from '../../lib/errors';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Local-disk storage for now; swapping to R2/S3 only needs this route to change.
export async function adminUploadRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const file = await req.file();
    if (!file) throw new HttpError(400, 'No file uploaded');
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) throw new HttpError(415, 'Only JPEG, PNG, WebP or GIF images are allowed');

    const dir = new Date().toISOString().slice(0, 7); // yyyy-mm
    const name = `${randomUUID()}.${ext}`;
    const dest = path.join(env.UPLOAD_DIR, dir, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await pipeline(file.file, createWriteStream(dest));
    if (file.file.truncated) {
      await unlink(dest);
      throw new HttpError(413, `File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`);
    }
    return reply.status(201).send({ url: `${env.PUBLIC_UPLOAD_URL}/${dir}/${name}` });
  });
}

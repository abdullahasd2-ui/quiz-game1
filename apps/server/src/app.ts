import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { adminAuthRoutes } from './api/admin/auth';
import { adminCategoryRoutes } from './api/admin/categories';
import { adminQuestionRoutes } from './api/admin/questions';
import { adminStatsRoutes } from './api/admin/stats';
import { adminUploadRoutes, MAX_UPLOAD_BYTES } from './api/admin/upload';
import { publicCategoryRoutes } from './api/public/categories';
import { authPlugin } from './auth/plugin';
import { env } from './env';
import { errorHandler } from './lib/errors';
import { attachGameServer, type GameServerOptions } from './game/socket';

export async function buildApp(gameOptions: GameServerOptions = {}) {
  const app = Fastify({ logger: env.NODE_ENV === 'test' ? false : { level: 'info' } });
  app.setErrorHandler(errorHandler);

  await app.register(cors, { origin: env.NODE_ENV === 'production' ? false : true, credentials: true });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await app.register(authPlugin);
  await app.register(fastifyStatic, { root: path.resolve(env.UPLOAD_DIR), prefix: `${env.PUBLIC_UPLOAD_URL}/` });

  app.get('/api/health', async () => ({ ok: true }));
  await app.register(publicCategoryRoutes, { prefix: '/api/categories' });

  attachGameServer(app, gameOptions);

  await app.register(adminAuthRoutes, { prefix: '/api/admin' });
  await app.register(
    async (admin) => {
      admin.addHook('onRequest', admin.requireAdmin);
      await admin.register(adminCategoryRoutes, { prefix: '/categories' });
      await admin.register(adminQuestionRoutes, { prefix: '/questions' });
      await admin.register(adminUploadRoutes, { prefix: '/upload' });
      await admin.register(adminStatsRoutes, { prefix: '/stats' });
    },
    { prefix: '/api/admin' },
  );

  const webDist = path.resolve(env.WEB_DIST);
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, decorateReply: false });
    // Client-side routes (/admin/questions/12, …) all load index.html; unknown API paths stay JSON 404s.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/socket.io/') && !req.url.startsWith(`${env.PUBLIC_UPLOAD_URL}/`)) {
        return reply.sendFile('index.html', webDist);
      }
      return reply.status(404).send({ error: 'Not found' });
    });
  }
  return app;
}

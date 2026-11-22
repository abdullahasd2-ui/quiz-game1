import { imageProxyRoutes } from './api/public/img';
import { restoreBundledUploads } from './lib/bundled-uploads';
import { tourRoutes } from './api/public/tour';
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
import { appUpdateRoutes } from './api/public/app-update';
import { publicCategoryRoutes } from './api/public/categories';
import { popularRoutes } from './api/public/popular';
import { authPlugin } from './auth/plugin';
import { env } from './env';
import { errorHandler } from './lib/errors';
import { adminAccountRoutes } from './api/admin/admins';
import { attachGameServer, type GameServerOptions } from './game/socket';
import { KickChatHub, resolveChatroomFromKick } from './kick/chat';
import { kickPusher } from './kick/pusher';
import { kickSlugs } from '@quiz/shared';
import { attachKickSync } from './kick/sync';
import { attachDuelSync } from './kick/duelSync';
import { createDuelRecorder } from './kick/duelStats';
import { createStreamRecorder } from './kick/streamStats';
import { db } from './db/client';
import { kickLinks } from './db/schema';
import { kickQuestionRoutes } from './kick/question';
import { kickOAuthRoutes } from './kick/oauth';
import { attachKickRelay } from './kick/socket';

export async function buildApp(gameOptions: GameServerOptions = {}) {
  const app = Fastify({ logger: env.NODE_ENV === 'test' ? false : { level: 'info' }, trustProxy: env.TRUST_PROXY });
  app.setErrorHandler(errorHandler);

  // Production: the web app is same-origin; only the mobile app is cross-origin, and it never sends cookies.
  const prod = env.NODE_ENV === 'production';
  await app.register(cors, { origin: prod ? env.APP_ORIGINS : true, credentials: !prod });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await app.register(authPlugin);
  await app.register(fastifyStatic, { root: path.resolve(env.UPLOAD_DIR), prefix: `${env.PUBLIC_UPLOAD_URL}/` });

  app.get('/api/health', async () => ({ ok: true }));
  await app.register(publicCategoryRoutes, { prefix: '/api/categories' });
  await app.register(popularRoutes, { prefix: '/api/popular' });
  await app.register(tourRoutes, { prefix: '/api/tour' });
  await app.register(imageProxyRoutes, { prefix: '/api/img', dir: path.resolve(env.UPLOAD_DIR) });
  // The legacy bank's pictures ship with the server; put back any the uploads volume is missing.
  await restoreBundledUploads(path.resolve(env.UPLOAD_DIR)).catch((err) => app.log.warn({ err }, 'restore bundled uploads'));
  await app.register(appUpdateRoutes, { prefix: '/api/app', dir: env.OTA_DIR, publicOrigin: env.PUBLIC_ORIGIN });

  const game = attachGameServer(app, gameOptions);
  const kickHub = new KickChatHub({ onError: (err) => app.log.warn({ err }, 'kick chat lookup failed') });
  attachKickRelay(game.io, kickHub);
  const recordStream = createStreamRecorder((err) => app.log.warn({ err }, 'kick stream stats'));
  const kickSync = attachKickSync(game.io, { onState: (st) => void recordStream(st) });
  const duels = attachDuelSync(game.io, createDuelRecorder((err) => app.log.error(err)));
  app.addHook('onClose', async () => kickHub.closeAll());
  await app.register(kickQuestionRoutes);
  // The chat room id of a Kick channel, for the stream page: Kick lets the server look a channel up but often refuses
  // its chat socket, while the streamer's browser can open the chat but not read Kick's API. Cached for 10 minutes.
  // The current key of Kick's chat feed, for the stream page (Kick rotates it; see kick/pusher.ts).
  app.get('/api/kick/pusher', async () => kickPusher());
  const chatrooms = new Map<string, { id: number; at: number }>();
  app.get<{ Params: { channel: string } }>('/api/kick/chatroom/:channel', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const channel = req.params.channel.toLowerCase();
    if (!kickSlugs(channel).length) return reply.code(400).send({ error: 'اسم القناة غير صالح' });
    const hit = chatrooms.get(channel);
    if (hit && Date.now() - hit.at < 600_000) return { id: hit.id };
    try {
      const id = await resolveChatroomFromKick(channel);
      chatrooms.set(channel, { id, at: Date.now() });
      return { id };
    } catch (err) {
      app.log.warn({ err, channel }, 'kick chatroom lookup failed');
      return reply.code(404).send({ error: `ما لقيت قناة «${channel}» في Kick` });
    }
  });
  await app.register(kickOAuthRoutes, {
    hub: kickHub,
    clientId: env.KICK_CLIENT_ID || undefined,
    clientSecret: env.KICK_CLIENT_SECRET || undefined,
    origin: env.PUBLIC_ORIGIN ?? 'https://jawabbadel.com',
    onLinked: async (kickUserId, channel) => {
      await db.insert(kickLinks).values({ kickUserId, channel: channel.slice(0, 64) });
    },
  });

  await app.register(adminAuthRoutes, { prefix: '/api/admin' });
  await app.register(
    async (admin) => {
      admin.addHook('onRequest', admin.requireAdmin);
      await admin.register(adminCategoryRoutes, { prefix: '/categories' });
      await admin.register(adminQuestionRoutes, { prefix: '/questions' });
      await admin.register(adminUploadRoutes, { prefix: '/upload' });
      await admin.register(adminStatsRoutes, { prefix: '/stats', live: game.live, kickLive: kickSync.live, duelLive: duels.live, adminScore: game.adminScore });
      await admin.register(adminAccountRoutes, { prefix: '/admins' });
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

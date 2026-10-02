import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import fp from 'fastify-plugin';
import { db } from '../db/client';
import { admins } from '../db/schema';
import { env } from '../env';

export const AUTH_COOKIE = 'admin_token';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; email: string };
    user: { sub: number; email: string };
  }
}
declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: AUTH_COOKIE, signed: false },
    sign: { expiresIn: SESSION_TTL_SECONDS },
  });
  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    // A deleted admin's token must stop working right away, not when it expires.
    const [admin] = await db.select({ id: admins.id }).from(admins).where(eq(admins.id, req.user.sub));
    if (!admin) return reply.status(401).send({ error: 'Unauthorized' });
  });
});

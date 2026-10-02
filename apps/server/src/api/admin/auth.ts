import { changeOwnPasswordInput, loginInput } from '@quiz/shared';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { AUTH_COOKIE, SESSION_TTL_SECONDS } from '../../auth/plugin';
import { db } from '../../db/client';
import { admins } from '../../db/schema';
import { env } from '../../env';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { email, password } = loginInput.parse(req.body);
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !ok) return reply.status(401).send({ error: 'Invalid email or password' });

    await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
    const token = await reply.jwtSign({ sub: admin.id, email: admin.email });
    reply.setCookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      path: '/api/admin',
      maxAge: SESSION_TTL_SECONDS,
    });
    return { id: admin.id, email: admin.email };
  });

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie(AUTH_COOKIE, { path: '/api/admin' });
    return { ok: true };
  });

  app.get('/me', { onRequest: [app.requireAdmin] }, async (req) => ({ id: req.user.sub, email: req.user.email }));

  app.post('/me/password', { onRequest: [app.requireAdmin], config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { currentPassword, password } = changeOwnPasswordInput.parse(req.body);
    const [admin] = await db.select().from(admins).where(eq(admins.id, req.user.sub));
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      return reply.status(400).send({ error: 'كلمة المرور الحالية غير صحيحة' });
    }
    await db.update(admins).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eq(admins.id, admin.id));
    return { ok: true };
  });
}

import { adminCreateInput, adminPasswordInput, type AdminAccount } from '@quiz/shared';
import bcrypt from 'bcryptjs';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client';
import { admins } from '../../db/schema';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const columns = { id: admins.id, email: admins.email, createdAt: admins.createdAt, lastLoginAt: admins.lastLoginAt };
const toAccount = (a: { id: number; email: string; createdAt: Date; lastLoginAt: Date | null }): AdminAccount => ({
  ...a,
  createdAt: a.createdAt.toISOString(),
  lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
});

/** Admin accounts. Every admin can manage the others, but not delete themselves (so one always remains). */
export async function adminAccountRoutes(app: FastifyInstance) {
  app.get('/', async () => (await db.select(columns).from(admins).orderBy(asc(admins.id))).map(toAccount));

  app.post('/', async (req, reply) => {
    const { email, password } = adminCreateInput.parse(req.body);
    const [created] = await db
      .insert(admins)
      .values({ email, passwordHash: await bcrypt.hash(password, 12) })
      .onConflictDoNothing({ target: admins.email })
      .returning(columns);
    if (!created) return reply.status(409).send({ error: 'هذا البريد مسجل كمشرف مسبقًا' });
    return reply.status(201).send(toAccount(created));
  });

  app.put('/:id/password', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { password } = adminPasswordInput.parse(req.body);
    const [updated] = await db.update(admins).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eq(admins.id, id)).returning(columns);
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return toAccount(updated);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    if (id === req.user.sub) return reply.status(400).send({ error: 'لا يمكنك حذف حسابك' });
    // The caller is another, existing admin, so this can never remove the last one.
    const deleted = await db.delete(admins).where(eq(admins.id, id)).returning({ id: admins.id });
    if (!deleted.length) return reply.status(404).send({ error: 'Not found' });
    return reply.status(204).send();
  });
}

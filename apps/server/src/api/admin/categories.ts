import { categoryInput } from '@quiz/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client';
import { categories } from '../../db/schema';
import { notFound } from '../../lib/errors';

const idParam = z.object({ id: z.coerce.number().int().positive() });

export async function adminCategoryRoutes(app: FastifyInstance) {
  app.get('/', async () => db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)));

  app.post('/', async (req, reply) => {
    const [row] = await db.insert(categories).values(categoryInput.parse(req.body)).returning();
    return reply.status(201).send(row);
  });

  app.patch('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const [row] = await db.update(categories).set(categoryInput.partial().parse(req.body)).where(eq(categories.id, id)).returning();
    if (!row) throw notFound('Category not found');
    return row;
  });

  // Fails with 409 while the category still has questions (FK is ON DELETE RESTRICT).
  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const [row] = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
    if (!row) throw notFound('Category not found');
    return reply.status(204).send();
  });
}

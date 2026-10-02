import type { FastifyInstance } from 'fastify';
import { listPublicCategories } from '../../game/catalog';

export async function publicCategoryRoutes(app: FastifyInstance) {
  app.get('/', () => listPublicCategories());
}

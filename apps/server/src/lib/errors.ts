import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
export const notFound = (what = 'Not found') => new HttpError(404, what);

// Postgres error codes surfaced through drizzle (which wraps them in `cause`).
const pgCode = (err: unknown): string | undefined => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
};

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: 'validation', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message });
  const code = pgCode(err);
  if (code === '23505') return reply.status(409).send({ error: 'Already exists' });
  if (code === '23503') return reply.status(409).send({ error: 'Still referenced by other records' });
  const status = (err as FastifyError).statusCode;
  if (status && status < 500) return reply.status(status).send({ error: err.message });
  req.log.error(err);
  return reply.status(500).send({ error: 'Internal server error' });
}

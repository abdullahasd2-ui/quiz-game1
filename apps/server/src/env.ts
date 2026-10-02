import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_UPLOAD_URL: z.string().default('/uploads'),
  // Built web app (apps/web/dist); served with SPA fallback when the folder exists.
  WEB_DIST: z.string().default('../web/dist'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = schema.parse(process.env);

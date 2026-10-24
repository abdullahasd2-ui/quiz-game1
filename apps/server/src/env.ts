import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_UPLOAD_URL: z.string().default('/uploads'),
  // Built web app (apps/web/dist); served with SPA fallback when the folder exists.
  WEB_DIST: z.string().default('../web/dist'),
  // Mobile app's OTA bundle (bundle.zip + ota.json, made by the Dockerfile); no update is offered without it.
  OTA_DIR: z.string().default('../mobile/ota'),
  // Public address of the site; OTA download links must be absolute. Defaults to the request's own host.
  PUBLIC_ORIGIN: z.url().optional(),
  // Behind a reverse proxy: take the client IP from X-Forwarded-For, so the login rate limit is per visitor.
  TRUST_PROXY: z.stringbool().default(false),
  // Origins of the mobile app's WebView (iOS, Android) allowed to call the public API and the game socket.
  APP_ORIGINS: z
    .string()
    .default('capacitor://localhost,https://localhost')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = schema.parse(process.env);

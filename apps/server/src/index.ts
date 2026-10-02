import { mkdir } from 'node:fs/promises';
import { buildApp } from './app';
import { env } from './env';

await mkdir(env.UPLOAD_DIR, { recursive: true });
const app = await buildApp();
await app.listen({ port: env.PORT, host: '0.0.0.0' });

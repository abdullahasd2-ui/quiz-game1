import { mkdir } from 'node:fs/promises';
import { buildApp } from './app';
import { env } from './env';

await mkdir(env.UPLOAD_DIR, { recursive: true });
const app = await buildApp();
await app.listen({ port: env.PORT, host: '0.0.0.0' });

// The «عدّها» question bank is built on first use; build it now, so the first player does not wait for it.
setTimeout(() => {
  void import('./kick/lists/bank').then(({ listBank }) => listBank()).catch((err) => app.log.error(err, 'list bank'));
}, 1000);

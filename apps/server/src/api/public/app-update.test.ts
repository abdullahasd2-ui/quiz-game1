import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from '../../lib/errors';
import { appUpdateRoutes, type AppUpdateOptions } from './app-update';

const zip = Buffer.from('PK\x03\x04 not really a zip');
const checksum = createHash('sha256').update(zip).digest('hex');
let dir: string;

async function build(opts: Partial<AppUpdateOptions> = {}) {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(appUpdateRoutes, { prefix: '/api/app', dir, publicOrigin: 'https://jawabbadel.com', ...opts });
  return app;
}

// What the plugin posts, trimmed.
const check = (app: FastifyInstance, versionName: string, versionCode = '2') =>
  app.inject({
    method: 'POST',
    url: '/api/app/update',
    payload: { platform: 'ios', app_id: 'com.jawabbadel.app', version_build: '1.0', version_name: versionName, version_code: versionCode },
  });

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'ota-'));
  await writeFile(path.join(dir, 'bundle.zip'), zip);
  await writeFile(path.join(dir, 'ota.json'), JSON.stringify({ version: '1.0.0-abc', minNativeBuild: 2 }));
});

afterAll(() => rm(dir, { recursive: true }));

describe('app OTA updates', () => {
  it('offers the bundle to an app running another one', async () => {
    const res = await check(await build(), '1.0.0-old');
    expect(res.json()).toEqual({ version: '1.0.0-abc', url: 'https://jawabbadel.com/api/app/bundles/1.0.0-abc.zip', checksum });
  });

  it('is up to date when the app already runs it', async () => {
    const res = await check(await build(), '1.0.0-abc');
    expect(res.json()).toMatchObject({ kind: 'up_to_date' });
  });

  it('skips native builds older than the bundle needs', async () => {
    const res = await check(await build(), 'builtin', '1');
    expect(res.json()).toMatchObject({ kind: 'up_to_date' });
  });

  it('offers nothing when the deploy has no bundle', async () => {
    const res = await check(await build({ dir: path.join(dir, 'missing') }), 'builtin');
    expect(res.json()).toMatchObject({ kind: 'up_to_date' });
  });

  it('links to the request host without a public origin', async () => {
    const res = await check(await build({ publicOrigin: undefined }), 'builtin');
    expect(res.json().url).toBe('http://localhost:80/api/app/bundles/1.0.0-abc.zip');
  });

  it('serves the zip under its version only', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/app/bundles/1.0.0-abc.zip' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.rawPayload.equals(zip)).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/app/bundles/1.0.0-old.zip' })).statusCode).toBe(404);
  });

  it('rejects a malformed check', async () => {
    const res = await (await build()).inject({ method: 'POST', url: '/api/app/update', payload: { version_code: '2' } });
    expect(res.statusCode).toBe(400);
  });
});

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../lib/errors';

/**
 * Live updates for the mobile app (self-hosted @capgo/capacitor-updater). On launch the app posts
 * its native build and current bundle version; the answer is the bundle built with this deploy,
 * unless the app already runs it or its native build predates a plugin the bundle needs.
 */
export type AppUpdateOptions = { dir: string; publicOrigin?: string };

const manifest = z.object({ version: z.string().min(1), minNativeBuild: z.number().int() });
// The plugin sends more (device id, OS, …); these two decide.
const updateCheck = z.object({ version_name: z.string(), version_code: z.coerce.number() });
const upToDate = { kind: 'up_to_date', message: 'No new version available' } as const;

function loadBundle(dir: string) {
  const zipFile = path.resolve(dir, 'bundle.zip');
  const manifestFile = path.resolve(dir, 'ota.json');
  if (!existsSync(zipFile) || !existsSync(manifestFile)) return null;
  const { version, minNativeBuild } = manifest.parse(JSON.parse(readFileSync(manifestFile, 'utf8')));
  const zip = readFileSync(zipFile);
  // The plugin rejects a download whose sha256 differs.
  return { version, minNativeBuild, zip, checksum: createHash('sha256').update(zip).digest('hex') };
}

export async function appUpdateRoutes(app: FastifyInstance, opts: AppUpdateOptions) {
  const bundle = loadBundle(opts.dir);

  app.post('/update', (req) => {
    const { version_name, version_code } = updateCheck.parse(req.body);
    if (!bundle || version_name === bundle.version || version_code < bundle.minNativeBuild) return upToDate;
    const origin = opts.publicOrigin ?? `${req.protocol}://${req.host}`;
    // The version is in the name so a cache (Cloudflare) never serves an older zip under the same URL.
    return { version: bundle.version, url: `${origin}/api/app/bundles/${bundle.version}.zip`, checksum: bundle.checksum };
  });

  app.get('/bundles/:file', (req, reply) => {
    const { file } = req.params as { file: string };
    if (!bundle || file !== `${bundle.version}.zip`) throw notFound();
    return reply.type('application/zip').header('cache-control', 'public, max-age=31536000, immutable').send(bundle.zip);
  });
}

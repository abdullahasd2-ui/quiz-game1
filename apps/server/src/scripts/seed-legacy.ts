// One-off import of the question bank embedded in the legacy index.html.
// Base64 images are written to UPLOAD_DIR/legacy; categories are upserted by slug,
// and a category that already has questions is skipped so the script is safe to re-run.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LEGACY_DRAW_PREFIX, POINTS, questionInput, type QuestionInput } from '@quiz/shared';
import { count, eq } from 'drizzle-orm';
import { db, sqlClient } from '../db/client';
import { categories, questions } from '../db/schema';
import { env } from '../env';

type LegacyCat = { id: string; name: string; icon: string };
type LegacyQ = { q: string; o: string[]; a: number; pts?: number; imgUrl?: string; revealUrl?: string; imgType?: string };

const htmlPath = process.argv[2] ?? path.resolve(import.meta.dirname, '../../../../index.html');
const html = await readFile(htmlPath, 'utf8');

function extractLiteral<T>(name: string, open: '[' | '{'): T {
  const close = open === '[' ? '\\]' : '\\}';
  const m = html.match(new RegExp(`const ${name}=(\\${open}[\\s\\S]*?\\n${close});`));
  if (!m?.[1]) throw new Error(`could not find ${name} in ${htmlPath}`);
  // The legacy file is our own source; evaluating its object literal is the most faithful parse.
  return new Function(`return ${m[1]}`)() as T;
}

const CATS = extractLiteral<LegacyCat[]>('CATS', '[');
const QDB = extractLiteral<Record<string, LegacyQ[]>>('QDB', '{');

const legacyDir = path.join(env.UPLOAD_DIR, 'legacy');
await mkdir(legacyDir, { recursive: true });

async function saveDataUrl(dataUrl: string, name: string): Promise<string> {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m?.[1] || !m[2]) throw new Error(`bad data URL for ${name}`);
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const file = `${name}.${ext}`;
  await writeFile(path.join(legacyDir, file), Buffer.from(m[2], 'base64'));
  return `${env.PUBLIC_UPLOAD_URL}/legacy/${file}`;
}
const imageUrlFor = (url: string | undefined, name: string) =>
  url?.startsWith('data:') ? saveDataUrl(url, name) : Promise.resolve(url ?? null);

const report: string[] = [];
for (const [sortOrder, cat] of CATS.entries()) {
  const [row] = await db
    .insert(categories)
    .values({ slug: cat.id, name: cat.name.trim(), icon: cat.icon, sortOrder })
    .onConflictDoUpdate({ target: categories.slug, set: { name: cat.name.trim(), icon: cat.icon, sortOrder } })
    .returning();
  if (!row) throw new Error(`upsert failed for ${cat.id}`);

  const [existing] = await db.select({ n: count() }).from(questions).where(eq(questions.categoryId, row.id));
  if (existing && existing.n > 0) {
    report.push(`${cat.id}: skipped (already has ${existing.n} questions)`);
    continue;
  }

  const legacy = QDB[cat.id] ?? [];
  const rows: QuestionInput[] = [];
  let inactive = 0;
  for (const [i, q] of legacy.entries()) {
    const points = q.pts ?? POINTS[i];
    const base = `${cat.id}-${points}`;
    const imageUrl = await imageUrlFor(q.imgUrl, `${base}-question`);
    const revealUrl = await imageUrlFor(q.revealUrl, `${base}-reveal`);
    // imgType questions were drawn on a <canvas> by the old client; there is no image file,
    // so import them inactive until a real image is uploaded from the dashboard.
    const drawn = Boolean(q.imgType);
    if (drawn) inactive++;
    rows.push(
      questionInput.parse({
        categoryId: row.id,
        type: drawn ? 'image' : q.imgUrl?.startsWith('data:') ? 'reveal' : q.imgUrl ? 'zoom' : 'text',
        text: q.q.trim(),
        options: q.o,
        correctIndex: q.a,
        points,
        imageUrl: drawn ? `${LEGACY_DRAW_PREFIX}${q.imgType}` : imageUrl,
        revealUrl,
        active: !drawn,
      }),
    );
  }
  if (rows.length) await db.insert(questions).values(rows);
  report.push(`${cat.id}: ${rows.length} questions${inactive ? ` (${inactive} inactive: need a real image)` : ''}`);
}

console.log(report.join('\n'));
await sqlClient.end();

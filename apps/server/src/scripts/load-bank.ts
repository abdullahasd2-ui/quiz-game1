// Loads question-bank proposals (e.g. written by Codex) as `pending` questions for review in the dashboard.
// Usage: npm run bank:load -- [file.json ...]   (default: every *.json in the repo's bank/ folder)
// Safe to re-run: questions whose text already exists in the same category are skipped.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { sqlClient } from '../db/client';
import { importItem, importQuestions } from '../lib/bank';
import { HttpError } from '../lib/errors';

const bankDir = path.resolve(import.meta.dirname, '../../../../bank');
const fileSchema = z.union([z.array(importItem), z.object({ questions: z.array(importItem) })]);

let files = process.argv.slice(2);
if (files.length === 0) {
  files = (await readdir(bankDir)).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(bankDir, f));
}

let failed = false;
for (const file of files) {
  const name = path.basename(file);
  try {
    const parsed = fileSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    const items = Array.isArray(parsed) ? parsed : parsed.questions;
    if (items.length === 0) continue;
    const { inserted, skipped } = await importQuestions(items, { status: 'pending', source: 'codex' });
    console.log(`${name}: ${inserted} added for review, ${skipped} already existed`);
  } catch (err) {
    failed = true;
    const message = err instanceof HttpError || err instanceof SyntaxError ? err.message : err instanceof z.ZodError ? z.prettifyError(err) : String(err);
    console.error(`${name}: not loaded — ${message}`);
  }
}
await sqlClient.end();
if (failed) process.exit(1);

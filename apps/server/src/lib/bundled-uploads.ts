import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** apps/server/uploads: pictures committed with the code (the legacy bank's «اكتشف الصورة»). */
const BUNDLED = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

/** Copies every bundled picture the uploads directory does not have yet (never overwrites). */
export async function restoreBundledUploads(dir: string) {
  if (path.resolve(dir) === BUNDLED) return 0;
  let restored = 0;
  const walk = async (rel: string) => {
    for (const e of await readdir(path.join(BUNDLED, rel), { withFileTypes: true }).catch(() => [])) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) await walk(r);
      else if (!(await stat(path.join(dir, r)).catch(() => null))) {
        await mkdir(path.dirname(path.join(dir, r)), { recursive: true });
        await copyFile(path.join(BUNDLED, r), path.join(dir, r));
        restored++;
      }
    }
  };
  await walk('');
  return restored;
}

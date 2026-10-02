// Usage: npm run admin:create -- <email> <password>
import { loginInput } from '@quiz/shared';
import bcrypt from 'bcryptjs';
import { db, sqlClient } from '../db/client';
import { admins } from '../db/schema';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Usage: npm run admin:create -- <email> <password (min 10 chars)>');
  process.exit(1);
}
const input = loginInput.parse({ email, password });
const passwordHash = await bcrypt.hash(input.password, 12);
await db
  .insert(admins)
  .values({ email: input.email, passwordHash })
  .onConflictDoUpdate({ target: admins.email, set: { passwordHash } });
console.log(`admin ready: ${input.email}`);
await sqlClient.end();

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sqlClient } from '../db/client';

await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
console.log('migrations applied');
await sqlClient.end();

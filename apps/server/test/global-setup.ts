import { rm } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Recreates the quiz_test database from the migrations before the suite runs.
export async function setup() {
  const adminSql = postgres('postgres://quiz:quiz@localhost:5434/quiz', { onnotice: () => {} });
  await adminSql.unsafe('drop database if exists quiz_test with (force)');
  await adminSql.unsafe('create database quiz_test');
  await adminSql.end();

  const sql = postgres('postgres://quiz:quiz@localhost:5434/quiz_test', { onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  await sql.end();
}

export async function teardown() {
  await rm('./.test-uploads', { recursive: true, force: true });
}

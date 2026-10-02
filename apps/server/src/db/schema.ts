import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { platforms, questionStatuses, questionTypes } from '@quiz/shared';

export const questionType = pgEnum('question_type', questionTypes);
export const questionStatus = pgEnum('question_status', questionStatuses);
export const devicePlatform = pgEnum('device_platform', platforms);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 60 }).notNull(),
  icon: varchar('icon', { length: 16 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable(
  'questions',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
    type: questionType('type').notNull().default('text'),
    text: varchar('text', { length: 500 }).notNull(),
    options: jsonb('options').$type<string[]>().notNull(),
    correctIndex: smallint('correct_index').notNull(),
    points: smallint('points').notNull(),
    imageUrl: text('image_url'),
    revealUrl: text('reveal_url'),
    reference: varchar('reference', { length: 500 }),
    status: questionStatus('status').notNull().default('approved'),
    // Who proposed it (e.g. "codex"); null for questions written in the dashboard.
    source: varchar('source', { length: 40 }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index('questions_category_points_idx').on(t.categoryId, t.points),
    index('questions_status_idx').on(t.status),
    check('questions_correct_index_check', sql`${t.correctIndex} between 0 and 3`),
    check('questions_points_check', sql`${t.points} in (100, 200, 300, 400, 500)`),
  ],
);

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 200 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

/**
 * One row per device per day it opened the game. The device id is the random id the
 * browser/app generates; nothing else about the visitor is stored.
 */
export const dailyVisits = pgTable(
  'daily_visits',
  {
    day: date('day').notNull(),
    deviceId: varchar('device_id', { length: 64 }).notNull(),
    platform: devicePlatform('platform').notNull(),
    /** Separate opens that day: a reconnect within 30 minutes of the last one doesn't count. */
    visits: integer('visits').notNull().default(1),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.deviceId] }), index('daily_visits_device_idx').on(t.deviceId)],
);

/** Every room ever created, for usage stats (the live room itself stays in memory). */
export const games = pgTable(
  'games',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 12 }).notNull(),
    mode: varchar('mode', { length: 10 }).notNull(),
    variant: varchar('variant', { length: 10 }).notNull(),
    categoryIds: jsonb('category_ids').$type<number[]>(),
    roundsPlayed: smallint('rounds_played').notNull().default(0),
    scores: jsonb('scores').$type<[number, number]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Closed before the last round (host left or the room went idle). */
    abandonedAt: timestamp('abandoned_at', { withTimezone: true }),
  },
  (t) => [index('games_created_at_idx').on(t.createdAt)],
);

import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, serial, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { questionTypes } from '@quiz/shared';

export const questionType = pgEnum('question_type', questionTypes);

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
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index('questions_category_points_idx').on(t.categoryId, t.points),
    check('questions_correct_index_check', sql`${t.correctIndex} between 0 and 3`),
    check('questions_points_check', sql`${t.points} in (100, 200, 300, 400, 500)`),
  ],
);

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 200 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

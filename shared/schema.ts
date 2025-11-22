import { sql } from 'drizzle-orm'
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { createInsertSchema } from 'drizzle-zod'

export const users = pgTable('users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  telegramId: integer('telegram_id').notNull(),
  username: text('username'),
  firstName: text('first_name'),
  context: jsonb('context').default({}), // сюда можно писать историю диалога
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
})

export const updateContextSchema = z.object({
  context: z.record(z.any()),
})

export const reminders = pgTable('reminders', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  text: text('text').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  isSent: boolean('is_sent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
  createdAt: true,
  isSent: true,
})

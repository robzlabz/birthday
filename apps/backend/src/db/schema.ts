import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from 'uuidv7';

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => uuidv7()),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    birthdayDate: text('birthday_date').notNull(),
    location: text('location').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const sentLogs = sqliteTable('sent_logs', {
    id: text('id').primaryKey().$defaultFn(() => uuidv7()),
    userId: text('user_id').notNull(),
    year: integer('year').notNull(),
    status: text('status', { enum: ['sent', 'failed'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
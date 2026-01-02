import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from 'uuidv7';

import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => uuidv7()),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    location: text('location').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
    events: many(userEvents),
}));

export const userEvents = sqliteTable('user_events', {
    id: text('id').primaryKey().$defaultFn(() => uuidv7()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['birthday', 'anniversary'] }).notNull(),
    eventDate: text('event_date').notNull(), // YYYY-MM-DD
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const userEventsRelations = relations(userEvents, ({ one }) => ({
    user: one(users, {
        fields: [userEvents.userId],
        references: [users.id],
    }),
}));

export const sentLogs = sqliteTable('sent_logs', {
    id: text('id').primaryKey().$defaultFn(() => uuidv7()),
    userId: text('user_id').notNull(),
    eventId: text('event_id'), // Reference to specific event
    year: integer('year').notNull(),
    status: text('status', { enum: ['sent', 'failed'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
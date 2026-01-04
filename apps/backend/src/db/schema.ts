import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { uuidv7 } from 'uuidv7';
import { relations, sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => uuidv7()),
    email: text('email').notNull().unique(),
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
    type: text('type').notNull(),
    eventDate: text('event_date').notNull(), // YYYY-MM-DD
    monthDay: text('month_day').notNull(), // MM-DD, for optimized indexing
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => [
    index('location_month_day_idx').on(table.monthDay), // We join with users for location
    index('month_day_idx').on(table.monthDay),
]);

export const userEventsRelations = relations(userEvents, ({ one }) => ({
    user: one(users, {
        fields: [userEvents.userId],
        references: [users.id],
    }),
}));

export const sentLogs = sqliteTable('sent_logs', {
    id: text('id').primaryKey().$defaultFn(() => uuidv7()),
    userId: text('user_id').notNull(),
    eventId: text('event_id').notNull().references(() => userEvents.id),
    year: integer('year').notNull(),
    status: text('status', { enum: ['sent', 'failed', 'pending'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => [
    uniqueIndex('unique_event_year_idx').on(table.userId, table.eventId, table.year),
]);
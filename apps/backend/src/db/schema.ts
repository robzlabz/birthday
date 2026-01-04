import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

export const users = sqliteTable("users", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    location: text("location").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const events = sqliteTable("events", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    type: text("type").notNull(), // 'BIRTHDAY', 'ANNIVERSARY'
    date: text("date").notNull(), // YYYY-MM-DD
    nextNotifyAt: integer("next_notify_at").notNull(), // timestamp
    version: integer("version").default(1).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const notificationLogs = sqliteTable("notification_logs", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    type: text("type").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp" }).notNull(),
    status: text("status").notNull(), // 'SUCCESS', 'FAILED'
});

export const usersRelations = relations(users, ({ many }) => ({
    events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
    user: one(users, {
        fields: [events.userId],
        references: [users.id],
    }),
}));

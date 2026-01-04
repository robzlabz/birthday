import { eq, lte, and, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { events, notificationLogs } from "../db/schema";
import * as schema from "../db/schema";

export class EventRepository {
    constructor(private readonly db: DrizzleD1Database<typeof schema>) { }

    async create(eventCtx: typeof events.$inferInsert) {
        const result = await this.db.insert(events).values(eventCtx).returning();
        return result[0];
    }

    async findById(id: string) {
        return this.db.query.events.findFirst({
            where: eq(events.id, id)
        });
    }

    async findPendingEvents(limit: number = 100) {
        const now = new Date();
        return this.db.query.events.findMany({
            where: lte(events.nextNotifyAt, now.getTime()),
            limit: limit,
            orderBy: (events, { asc }) => [asc(events.nextNotifyAt)],
        });
    }

    async updateSchedule(
        id: string,
        nextNotifyAt: Date,
        currentVersion: number
    ) {
        const result = await this.db
            .update(events)
            .set({
                nextNotifyAt: nextNotifyAt.getTime(),
                version: sql`${events.version} + 1`,
                updatedAt: new Date(),
            })
            .where(and(eq(events.id, id), eq(events.version, currentVersion)))
            .returning();

        return result[0];
    }

    async logNotification(payload: {
        userId: string;
        type: string;
        status: "SUCCESS" | "FAILED";
        sentAt: Date;
    }) {
        return this.db.insert(notificationLogs).values(payload).returning();
    }

    async deleteByUserId(userId: string) {
        return this.db.delete(events).where(eq(events.userId, userId));
    }
}

import { eq, lte, and, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { events } from "../db/schema";
import * as schema from "../db/schema";

export class EventRepository {
    constructor(private readonly db: DrizzleD1Database<typeof schema>) { }

    /**
     * Create new event.
     * Biasanya dipanggil dalam transaction bersama User creation.
     */
    async create(eventCtx: typeof events.$inferInsert) {
        // Drizzle insert returning
        const result = await this.db.insert(events).values(eventCtx).returning();
        return result[0];
    }

    /**
     * Mencari event yang perlu dieksekusi (Next Notify <= Now).
     * Limit untuk batch processing.
     */
    async findPendingEvents(limit: number = 100) {
        const now = new Date();

        return this.db.query.events.findMany({
            where: lte(events.nextNotifyAt, now.getTime()),
            limit: limit,
            // Order by priority/time if needed? For now just take oldest due.
            orderBy: (events, { asc }) => [asc(events.nextNotifyAt)],
        });
    }

    /**
     * Update jadwal event setelah notifikasi sukses.
     * Menggunakan Optimistic Locking (version check).
     */
    async updateSchedule(id: string, nextNotifyAt: Date, currentVersion: number) {
        const result = await this.db
            .update(events)
            .set({
                nextNotifyAt: nextNotifyAt.getTime(),
                version: sql`${events.version} + 1`,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(events.id, id),
                    eq(events.version, currentVersion)
                )
            )
            .returning();

        return result[0];
    }

    /**
     * Delete events by userId (Cleanup)
     */
    async deleteByUserId(userId: string) {
        return this.db.delete(events).where(eq(events.userId, userId));
    }
}

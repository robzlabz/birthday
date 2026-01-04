import { DrizzleD1Database } from "drizzle-orm/d1";
import { users, events } from "../db/schema";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

export class UserRepository {
    constructor(private readonly db: DrizzleD1Database<typeof schema>) { }

    /**
     * Create User and their Birthday Event Transactionally.
     * Uses db.batch() for D1 compatibility.
     */
    async createWithEvent(
        userCtx: typeof users.$inferInsert,
        eventCtx: Omit<typeof events.$inferInsert, 'userId'>
    ) {
        // Pre-generate IDs to enable batching dependent inserts
        const userId = crypto.randomUUID();
        const eventId = crypto.randomUUID();

        // 1. Prepare User Insert
        const newUser = {
            ...userCtx,
            id: userId, // Explicitly set ID
        };

        // 2. Prepare Event Insert
        const newEvent = {
            ...eventCtx,
            id: eventId,
            userId: userId,
        };

        // 3. Execute Batch
        const batchResults = await this.db.batch([
            this.db.insert(users).values(newUser).returning(),
            this.db.insert(events).values(newEvent).returning()
        ]);

        const userResult = batchResults[0] as unknown as typeof users.$inferSelect[];
        const eventResult = batchResults[1] as unknown as typeof events.$inferSelect[];

        return {
            user: userResult[0],
            event: eventResult[0]
        };
    }

    /**
     * Update User and Reset Events Transactionally.
     * Deletes all existing events and creates a new one.
     */
    /**
     * Update User and Reset Events Transactionally.
     * Uses db.batch() for D1 compatibility.
     */
    async updateWithEventReset(
        userId: string,
        userCtx: Partial<typeof users.$inferInsert>,
        eventCtx: Omit<typeof events.$inferInsert, 'userId'>
    ) {
        // 1. Prepare Update User
        const updateUserQuery = this.db
            .update(users)
            .set({ ...userCtx, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();

        // 2. Prepare Delete Events
        const deleteEventsQuery = this.db.delete(events).where(eq(events.userId, userId));

        // 3. Prepare New Event
        const eventId = crypto.randomUUID();
        const newEvent = {
            ...eventCtx,
            id: eventId,
            userId: userId,
        };
        const insertEventQuery = this.db.insert(events).values(newEvent).returning();

        // Execute Batch
        const batchResults = await this.db.batch([
            updateUserQuery,
            deleteEventsQuery,
            insertEventQuery
        ]);

        const updatedUserResult = batchResults[0] as unknown as typeof users.$inferSelect[];
        const insertedEventResult = batchResults[2] as unknown as typeof events.$inferSelect[];

        if (!updatedUserResult || updatedUserResult.length === 0) {
            throw new Error("User not found");
        }

        return {
            user: updatedUserResult[0],
            event: insertedEventResult[0]
        };
    }

    async findById(id: string) {
        return this.db.query.users.findFirst({
            where: eq(users.id, id),
        });
    }

    async findAll() {
        return this.db.query.users.findMany({
            orderBy: (users, { desc }) => [desc(users.createdAt)],
            with: {
                events: true
            }
        });
    }

    async delete(id: string) {
        return this.db.delete(users).where(eq(users.id, id)).returning();
    }
}

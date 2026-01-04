import { DrizzleD1Database } from "drizzle-orm/d1";
import { users, events } from "../db/schema";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

export class UserRepository {
    constructor(private readonly db: DrizzleD1Database<typeof schema>) { }

    /**
     * Create User and their Birthday Event Transactionally.
     */
    async createWithEvent(
        userCtx: typeof users.$inferInsert,
        eventCtx: Omit<typeof events.$inferInsert, 'userId'>
    ) {
        return await this.db.transaction(async (tx) => {
            // 1. Insert User
            const [user] = await tx.insert(users).values(userCtx).returning();

            // 2. Insert Event
            const eventPayload = {
                ...eventCtx,
                userId: user.id,
            };

            const [event] = await tx.insert(events).values(eventPayload).returning();

            return { user, event };
        });
    }

    /**
     * Update User and Reset Events Transactionally.
     * Deletes all existing events and creates a new one.
     */
    async updateWithEventReset(
        userId: string,
        userCtx: Partial<typeof users.$inferInsert>,
        eventCtx: Omit<typeof events.$inferInsert, 'userId'>
    ) {
        return await this.db.transaction(async (tx) => {
            // 1. Update User
            const [updatedUser] = await tx
                .update(users)
                .set({ ...userCtx, updatedAt: new Date() })
                .where(eq(users.id, userId))
                .returning();

            if (!updatedUser) {
                throw new Error("User not found");
            }

            // 2. Delete ALL existing events for this user
            await tx.delete(events).where(eq(events.userId, userId));

            // 3. Create NEW Event
            const eventPayload = {
                ...eventCtx,
                userId: userId,
            };

            const [newEvent] = await tx.insert(events).values(eventPayload).returning();

            return { user: updatedUser, event: newEvent };
        });
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
                // If we want events, we need relations defined. For now just users.
                // But UI likely wants to see the birthday/event date?
                // Schema doesn't have relations defined in `schema.ts`.
                // So I will just return users. UI can query get users.
                // Or I fetch events separately?
                // Let's stick to simple users list first.
            }
        });
    }

    async delete(id: string) {
        return this.db.delete(users).where(eq(users.id, id)).returning();
    }
}

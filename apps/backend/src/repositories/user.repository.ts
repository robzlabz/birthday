import { eq, and, inArray } from 'drizzle-orm';
import { users, userEvents } from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { CreateUser, UpdateUser, UserEventModel } from '../schema';

export class UserRepository {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getById(id: string) {
        return await this.db.query.users.findFirst({
            where: eq(users.id, id),
            with: {
                events: true
            }
        });
    }

    async list() {
        return await this.db.select().from(users).all();
    }

    async create(data: CreateUser) {
        const { events, ...userData } = data;

        return await this.db.transaction(async (tx) => {
            const newUser = await tx.insert(users).values(userData).returning().get();

            if (events && events.length > 0) {
                await tx.insert(userEvents).values(
                    events.map((event: UserEventModel) => ({
                        ...event,
                        userId: newUser.id,
                        monthDay: event.eventDate.substring(5, 10) // Extract MM-DD
                    }))
                );
            }

            return newUser;
        });
    }

    async update(id: string, data: UpdateUser) {
        return await this.db.update(users).set(data).where(eq(users.id, id)).returning().get();
    }

    async delete(id: string) {
        return await this.db.delete(users).where(eq(users.id, id)).returning().get();
    }
}

import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { users, userEvents } from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { CreateUser, UpdateUser } from '../schema/user.schema';

// CRUD normal dengan binding D1
export class UserService {
    private db: DrizzleD1Database<typeof schema>;

    constructor(dbBinding: D1Database) {
        this.db = getDb(dbBinding);
    }

    async getById(id: string) {
        return await this.db.query.users.findFirst({
            where: eq(users.id, id),
            with: {
                events: true
            }
        });
    }

    async create(data: CreateUser) {
        const { events, ...userData } = data;

        return await this.db.transaction(async (tx) => {
            const newUser = await tx.insert(users).values(userData).returning().get();

            if (events && events.length > 0) {
                await tx.insert(userEvents).values(
                    events.map(event => ({
                        ...event,
                        userId: newUser.id
                    }))
                );
            }

            return newUser;
        });
    }

    async update(id: string, data: UpdateUser) {
        // Simple update for now, doesn't handle event updates yet
        return await this.db.update(users).set(data).where(eq(users.id, id)).returning().get();
    }

    async list() {
        return await this.db.select().from(users).all();
    }
}

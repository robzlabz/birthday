import { eq, and, inArray } from 'drizzle-orm';
import { users, userEvents } from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { CreateUser, UpdateUser, UserEventModel } from '../schema';

export interface IUserRepository {
    getById(id: string): Promise<any>;
    list(): Promise<any[]>;
    create(data: CreateUser): Promise<any>;
    update(id: string, data: UpdateUser): Promise<any>;
    delete(id: string): Promise<any>;
}

export class UserRepository implements IUserRepository {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getById(id: string) {
        return await this.db.query.users.findFirst({
            where: eq(users.id, id) as any,
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

            return await tx.query.users.findFirst({
                where: eq(users.id, newUser.id) as any,
                with: {
                    events: true
                }
            });
        });
    }

    async update(id: string, data: UpdateUser) {
        const { events, ...userData } = data;

        return await this.db.transaction(async (tx) => {
            const updatedUser = await tx.update(users)
                .set(userData)
                .where(eq(users.id, id) as any)
                .returning()
                .get();

            if (!updatedUser) return null;

            if (events !== undefined) {
                // Remove existing events
                await tx.delete(userEvents).where(eq(userEvents.userId, id) as any);

                // Insert new events if any
                if (events.length > 0) {
                    await tx.insert(userEvents).values(
                        events.map((event: UserEventModel) => ({
                            ...event,
                            userId: id,
                            monthDay: event.eventDate.substring(5, 10) // Extract MM-DD
                        }))
                    );
                }
            }

            // Return user with events
            return await tx.query.users.findFirst({
                where: eq(users.id, id) as any,
                with: {
                    events: true
                }
            });
        });
    }

    async delete(id: string) {
        return await this.db.delete(users).where(eq(users.id, id) as any).returning().get();
    }
}

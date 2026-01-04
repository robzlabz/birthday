import { eq, and, inArray, sql } from 'drizzle-orm';
import { users, userEvents, sentLogs } from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export interface DiscoveryResult {
    user: typeof users.$inferSelect;
    event: typeof userEvents.$inferSelect;
}

export interface IEventRepository {
    findActiveEvents(timezones: string[], monthDay: string): Promise<DiscoveryResult[]>;
    findLeaplingEvents(timezones: string[]): Promise<DiscoveryResult[]>;
    isAlreadySent(userId: string, eventId: string, year: number): Promise<boolean>;
    getLogStatus(userId: string, eventId: string, year: number): Promise<any>;
    markAsSent(userId: string, eventId: string, year: number, status?: 'sent' | 'pending' | 'failed'): Promise<any>;
    updateLogStatus(userId: string, eventId: string, year: number, status: 'sent' | 'pending' | 'failed'): Promise<any>;
}

export class EventRepository implements IEventRepository {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    /**
     * Finds events that match the given timezones and month-day string.
     * Uses the indexed monthDay column for O(log N) scalability.
     */
    async findActiveEvents(timezones: string[], monthDay: string): Promise<DiscoveryResult[]> {
        return await this.db.select({
            user: users,
            event: userEvents
        })
            .from(userEvents)
            .innerJoin(users, eq(userEvents.userId, users.id))
            .where(
                and(
                    inArray(users.location, timezones),
                    eq(userEvents.monthDay, monthDay)
                )
            )
            .all();
    }

    /**
     * Finds Feb 29 events for a given set of timezones.
     */
    async findLeaplingEvents(timezones: string[]): Promise<DiscoveryResult[]> {
        return await this.db.select({
            user: users,
            event: userEvents
        })
            .from(userEvents)
            .innerJoin(users, eq(userEvents.userId, users.id))
            .where(
                and(
                    inArray(users.location, timezones),
                    eq(userEvents.monthDay, '02-29')
                )
            )
            .all();
    }

    /**
     * Checks if an event has already been sent for a specific year.
     * Guaranteed by unique composite index in schema.
     */
    async isAlreadySent(userId: string, eventId: string, year: number): Promise<boolean> {
        const log = await this.getLogStatus(userId, eventId, year);
        return !!log;
    }

    async getLogStatus(userId: string, eventId: string, year: number) {
        return await this.db.select()
            .from(sentLogs)
            .where(
                and(
                    eq(sentLogs.userId, userId),
                    eq(sentLogs.eventId, eventId),
                    eq(sentLogs.year, year)
                )
            )
            .get();
    }

    async markAsSent(userId: string, eventId: string, year: number, status: 'sent' | 'pending' | 'failed' = 'pending') {
        return await this.db.insert(sentLogs).values({
            userId,
            eventId,
            year,
            status
        }).onConflictDoNothing().returning().get();
    }

    async updateLogStatus(userId: string, eventId: string, year: number, status: 'sent' | 'pending' | 'failed') {
        return await this.db.update(sentLogs)
            .set({ status })
            .where(
                and(
                    eq(sentLogs.userId, userId),
                    eq(sentLogs.eventId, eventId),
                    eq(sentLogs.year, year)
                )
            )
            .returning()
            .get();
    }
}

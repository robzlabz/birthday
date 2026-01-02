import { eq, and, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { users, userEvents } from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export class EventService {
    private db: DrizzleD1Database<typeof schema>;
    private queue: Queue;

    constructor(dbBinding: D1Database, queueBinding: Queue) {
        this.db = getDb(dbBinding);
        this.queue = queueBinding;
    }

    /**
     * Checks for events (birthdays, anniversaries) and pushes them to the queue.
     * Targeted for high performance and efficiency.
     */
    async checkAndQueue(now: Date = new Date()) {
        console.log(`[EventService] Checking events for reference time: ${now.toISOString()}`);

        const targetHour = 9; // Notification hour in local time
        const activeTimezones = this.getAffectedTimezones(now, targetHour);

        if (activeTimezones.length === 0) {
            console.log("[EventService] No timezones are currently in the target notification window.");
            return;
        }

        const dateToTimezones = this.groupByLocalDate(now, activeTimezones);

        for (const [localDateStr, timezones] of Object.entries(dateToTimezones)) {
            const [year, month, day] = localDateStr.split('-').map(Number);
            const isLeapYear = this.isLeapYear(year);
            const eventSuffix = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            console.log(`[EventService] Querying events for ${eventSuffix} in timezones: ${timezones.join(', ')}`);

            // Query joined users and userEvents
            const matchedEvents = await this.db.select({
                user: users,
                event: userEvents
            })
                .from(userEvents)
                .innerJoin(users, eq(userEvents.userId, users.id))
                .where(
                    and(
                        inArray(users.location, timezones),
                        sql`strftime('%m-%d', ${userEvents.eventDate}) = ${eventSuffix}`
                    )
                )
                .all();

            // Edge Case: February 29th on Non-Leap Years
            if (month === 3 && day === 1 && !isLeapYear) {
                console.log("[EventService] Non-leap year detected on March 1st. Including Feb 29th events.");
                const leaplings = await this.db.select({
                    user: users,
                    event: userEvents
                })
                    .from(userEvents)
                    .innerJoin(users, eq(userEvents.userId, users.id))
                    .where(
                        and(
                            inArray(users.location, timezones),
                            sql`strftime('%m-%d', ${userEvents.eventDate}) = '02-29'`
                        )
                    )
                    .all();
                matchedEvents.push(...leaplings);
            }

            if (matchedEvents.length > 0) {
                await this.publishToQueue(matchedEvents);
            }
        }
    }

    private getAffectedTimezones(now: Date, targetHour: number): string[] {
        const allTimezones = Intl.supportedValuesOf("timeZone");
        return allTimezones.filter(tz => {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                hour12: false
            });
            const localHour = parseInt(formatter.format(now));
            return localHour === targetHour;
        });
    }

    private groupByLocalDate(now: Date, timezones: string[]): Record<string, string[]> {
        const groups: Record<string, string[]> = {};
        for (const tz of timezones) {
            const formatter = new Intl.DateTimeFormat('en-CA', { // YYYY-MM-DD format
                timeZone: tz,
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            });
            const localDate = formatter.format(now); // "YYYY-MM-DD"
            if (!groups[localDate]) groups[localDate] = [];
            groups[localDate].push(tz);
        }
        return groups;
    }

    // check if a year is a leap year for february 29th
    private isLeapYear(year: number): boolean {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    private async publishToQueue(eventsToNotify: Array<{ user: any, event: any }>) {
        console.log(`[EventService] Publishing ${eventsToNotify.length} events to the queue.`);

        const batchSize = 100;
        for (let i = 0; i < eventsToNotify.length; i += batchSize) {
            const batch = eventsToNotify.slice(i, i + batchSize).map(({ user, event }) => ({
                body: {
                    userId: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    location: user.location,
                    eventType: event.type,
                    eventDate: event.eventDate,
                    processYear: new Date().getFullYear()
                }
            }));
            await this.queue.sendBatch(batch);
        }
    }
}

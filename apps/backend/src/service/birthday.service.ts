import { eq, and, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { users } from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export class BirthdayService {
    private db: DrizzleD1Database<typeof schema>;
    private queue: Queue;

    constructor(dbBinding: D1Database, queueBinding: Queue) {
        this.db = getDb(dbBinding);
        this.queue = queueBinding;
    }

    /**
     * Checks for birthdays and pushes them to the queue.
     * Targeted for high performance and efficiency.
     */
    async checkAndQueue(now: Date = new Date()) {
        console.log(`[BirthdayService] Checking birthdays for reference time: ${now.toISOString()}`);

        const targetHour = 9; // Notification hour in local time
        const activeTimezones = this.getAffectedTimezones(now, targetHour);

        if (activeTimezones.length === 0) {
            console.log("[BirthdayService] No timezones are currently in the target notification window.");
            return;
        }

        // We handle multiple potential "today" dates (e.g. UTC 00:01 is tomorrow for some and today for others)
        // although filtering by timezone usually narrows this down to a specific local date.
        const dateToTimezones = this.groupByLocalDate(now, activeTimezones);

        for (const [localDateStr, timezones] of Object.entries(dateToTimezones)) {
            const [year, month, day] = localDateStr.split('-').map(Number);
            const isLeapYear = this.isLeapYear(year);
            const birthdaySuffix = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            console.log(`[BirthdayService] Querying users for ${birthdaySuffix} in timezones: ${timezones.join(', ')}`);

            // Primary query: users in active timezones with matching MM-DD
            let query = this.db.select()
                .from(users)
                .where(
                    and(
                        inArray(users.location, timezones),
                        sql`strftime('%m-%d', ${users.birthdayDate}) = ${birthdaySuffix}`
                    )
                );

            const matchedUsers = await query.all();

            // Edge Case: February 29th on Non-Leap Years
            // If today is March 1st and it's NOT a leap year, we also need to catch the "Leaplings"
            if (month === 3 && day === 1 && !isLeapYear) {
                console.log("[BirthdayService] Non-leap year detected on March 1st. Including Feb 29th birthdays.");
                const leaplings = await this.db.select()
                    .from(users)
                    .where(
                        and(
                            inArray(users.location, timezones),
                            sql`strftime('%m-%d', ${users.birthdayDate}) = '02-29'`
                        )
                    )
                    .all();
                matchedUsers.push(...leaplings);
            }

            if (matchedUsers.length > 0) {
                await this.publishToQueue(matchedUsers);
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

    private isLeapYear(year: number): boolean {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    private async publishToQueue(usersToNotify: Array<any>) {
        console.log(`[BirthdayService] Publishing ${usersToNotify.length} users to the queue.`);

        // Cloudflare Queue sendBatch supports up to 100 messages at a time.
        const batchSize = 100;
        for (let i = 0; i < usersToNotify.length; i += batchSize) {
            const batch = usersToNotify.slice(i, i + batchSize).map(user => ({
                body: {
                    userId: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    location: user.location,
                    birthdayDate: user.birthdayDate,
                    processYear: new Date().getFullYear() // Useful for idempotency checks later
                }
            }));
            await this.queue.sendBatch(batch);
        }
    }
}

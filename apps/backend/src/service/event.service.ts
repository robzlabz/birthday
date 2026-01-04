import { getDb } from '../db';
import { EventRepository } from '../repositories/event.repository';

export class EventService {
    private repository: EventRepository;
    private queue: Queue;

    constructor(dbBinding: D1Database, queueBinding: Queue) {
        const db = getDb(dbBinding);
        this.repository = new EventRepository(db);
        this.queue = queueBinding;
    }

    /**
     * Checks for events and pushes them to the queue.
     * Includes "Catch-up" logic to recover missed events from downtime.
     */
    async checkAndQueue(now: Date = new Date()) {
        console.log(`[EventService] Checking events for reference time: ${now.toISOString()}`);

        const targetHour = 9;
        const { activeTz, missedTz } = this.getTimezoneWindows(now, targetHour);

        console.log(`[EventService] Active timezones (current 9am): ${activeTz.length}`);
        console.log(`[EventService] Catch-up timezones (missed 9am): ${missedTz.length}`);

        // 1. Process Active Timezones (Normal logic)
        await this.processTimezones(now, activeTz);

        // 2. Process Missed Timezones (Recovery Logic)
        // We check if events were sent for "today" in those timezones.
        // If the service was down during their 9am, we'll find them here.
        if (missedTz.length > 0) {
            console.log(`[EventService] Running recovery logic for ${missedTz.length} timezones.`);
            await this.processTimezones(now, missedTz);
        }
    }

    private async processTimezones(now: Date, timezones: string[]) {
        if (timezones.length === 0) return;

        const dateToTimezones = this.groupByLocalDate(now, timezones);

        for (const [localDateStr, tzs] of Object.entries(dateToTimezones)) {
            const date = new Date(localDateStr);
            const monthDay = localDateStr.substring(5, 10); // MM-DD
            const isLeapYearIdx = this.isLeapYear(date.getFullYear());

            let discoveries = await this.repository.findActiveEvents(tzs, monthDay);

            // Leap Year Recovery: today is March 1st and not a leap year -> get Feb 29 events
            if (monthDay === '03-01' && !isLeapYearIdx) {
                const leaplings = await this.repository.findLeaplingEvents(tzs);
                discoveries.push(...leaplings);
            }

            if (discoveries.length > 0) {
                await this.filterAndQueue(discoveries, date.getFullYear());
            }
        }
    }

    private async filterAndQueue(discoveries: any[], year: number) {
        const toQueue = [];

        for (const item of discoveries) {
            // Strict Idempotency: verify not already sent
            const alreadySent = await this.repository.isAlreadySent(item.user.id, item.event.id, year);
            if (!alreadySent) {
                toQueue.push(item);
                // Mark as pending initially to prevent race conditions if multiple instances run
                await this.repository.markAsSent(item.user.id, item.event.id, year, 'pending');
            }
        }

        if (toQueue.length > 0) {
            await this.publishToQueue(toQueue, year);
        }
    }

    private getTimezoneWindows(now: Date, targetHour: number) {
        const allTimezones = Intl.supportedValuesOf("timeZone");
        const activeTz: string[] = [];
        const missedTz: string[] = [];

        for (const tz of allTimezones) {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                hour12: false
            });
            const localHour = parseInt(formatter.format(now));

            if (localHour === targetHour) {
                activeTz.push(tz);
            } else if (localHour > targetHour && localHour < targetHour + 2) {
                // If it's between 10am and 11am, it might have been missed if service was down at 9am.
                // Our idempotency check ensures we don't send twice.
                missedTz.push(tz);
            }
        }

        return { activeTz, missedTz };
    }

    private groupByLocalDate(now: Date, timezones: string[]): Record<string, string[]> {
        const groups: Record<string, string[]> = {};
        for (const tz of timezones) {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            });
            const localDate = formatter.format(now);
            if (!groups[localDate]) groups[localDate] = [];
            groups[localDate].push(tz);
        }
        return groups;
    }

    private isLeapYear(year: number): boolean {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    private async publishToQueue(events: any[], year: number) {
        const batchSize = 100;
        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize).map(({ user, event }) => ({
                body: {
                    userId: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    location: user.location,
                    eventId: event.id,
                    eventType: event.type,
                    eventDate: event.eventDate,
                    processYear: year
                }
            }));
            await this.queue.sendBatch(batch);
        }
    }
}

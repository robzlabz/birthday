import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventRepository } from './event.repository';
import { UserRepository } from './user.repository';
import { setupTestDb } from '../test/db.setup';

describe('EventRepository', () => {
    let eventRepo: EventRepository;
    let userRepo: UserRepository;
    let db: any;
    let cleanupFn: () => void;

    beforeEach(async () => {
        const { db: testDb, initDb, cleanup } = setupTestDb();
        await initDb();
        db = testDb;
        cleanupFn = cleanup;
        eventRepo = new EventRepository(db as any);
        userRepo = new UserRepository(db as any);
    });

    afterEach(() => {
        cleanupFn();
    });

    it('should find active events for specific timezones and month-day', async () => {
        // Create users in different timezones
        const user1 = await userRepo.create({
            email: 'user1@example.com',
            firstName: 'UTC',
            lastName: 'User',
            location: 'UTC',
            events: [{ type: 'birthday', eventDate: '1990-05-20' }]
        });

        const user2 = await userRepo.create({
            email: 'user2@example.com',
            firstName: 'Jakarta',
            lastName: 'User',
            location: 'Asia/Jakarta',
            events: [{ type: 'birthday', eventDate: '1995-05-20' }]
        });

        const results = await eventRepo.findActiveEvents(['UTC'], '05-20');
        expect(results).toHaveLength(1);
        expect(results[0].user.email).toBe('user1@example.com');
    });

    it('should find leapling events', async () => {
        const leapling = await userRepo.create({
            email: 'leapling@example.com',
            firstName: 'Leap',
            lastName: 'Year',
            location: 'UTC',
            events: [{ type: 'birthday', eventDate: '1996-02-29' }]
        });

        const results = await eventRepo.findLeaplingEvents(['UTC']);
        expect(results).toHaveLength(1);
        expect(results[0].user.email).toBe('leapling@example.com');
    });

    it('should track sent logs correctly', async () => {
        const user = await userRepo.create({
            email: 'log@example.com',
            firstName: 'Log',
            lastName: 'Test',
            location: 'UTC',
            events: [{ type: 'birthday', eventDate: '1990-01-01' }]
        });

        const userWithEvents = await userRepo.getById(user!.id);
        expect(userWithEvents).toBeDefined();
        const eventId = (userWithEvents as any).events[0].id;
        const year = 2024;

        // Initially not sent
        const alreadySent = await eventRepo.isAlreadySent(user!.id, eventId, year);
        expect(alreadySent).toBe(false);

        // Mark as pending
        await eventRepo.markAsSent(user!.id, eventId, year, 'pending');
        expect(await eventRepo.isAlreadySent(user!.id, eventId, year)).toBe(true);

        const status = await eventRepo.getLogStatus(user!.id, eventId, year);
        expect(status?.status).toBe('pending');

        // Update to sent
        await eventRepo.updateLogStatus(user!.id, eventId, year, 'sent');
        const updatedStatus = await eventRepo.getLogStatus(user!.id, eventId, year);
        expect(updatedStatus?.status).toBe('sent');
    });
});

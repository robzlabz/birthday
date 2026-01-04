import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserRepository } from './user.repository';
import { setupTestDb } from '../test/db.setup';
import { CreateUser } from '../schema';

describe('UserRepository', () => {
    let repo: UserRepository;
    let db: any;
    let cleanupFn: () => void;

    beforeEach(async () => {
        const { db: testDb, initDb, cleanup } = setupTestDb();
        await initDb();
        db = testDb;
        cleanupFn = cleanup;
        repo = new UserRepository(db as any);
    });

    afterEach(() => {
        cleanupFn();
    });

    it('should create a user without events', async () => {
        const userData: CreateUser = {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            location: 'UTC'
        };

        const user = await repo.create(userData);
        expect(user).toBeDefined();
        expect(user!.email).toBe(userData.email);

        const fetched = await repo.getById(user!.id);
        expect(fetched).toBeDefined();
        expect(fetched!.email).toBe(userData.email);
        expect((fetched as any).events).toHaveLength(0);
    });

    it('should create a user with events', async () => {
        const userData: CreateUser = {
            email: 'jane@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            location: 'Asia/Jakarta',
            events: [
                { type: 'birthday', eventDate: '1990-05-20' }
            ]
        };

        const user = await repo.create(userData);
        expect(user).toBeDefined();

        const fetched = await repo.getById(user!.id);
        expect(fetched).toBeDefined();
        expect((fetched as any).events).toHaveLength(1);
        expect((fetched as any).events[0].type).toBe('birthday');
        expect((fetched as any).events[0].monthDay).toBe('05-20');
    });

    it('should update user and sync events', async () => {
        const userData: CreateUser = {
            email: 'update@example.com',
            firstName: 'Original',
            lastName: 'Name',
            location: 'UTC',
            events: [
                { type: 'birthday', eventDate: '1990-01-01' }
            ]
        };

        const user = await repo.create(userData);
        expect(user).toBeDefined();

        const updated = await repo.update(user!.id, {
            firstName: 'Updated',
            events: [
                { type: 'anniversary', eventDate: '2020-10-10' }
            ]
        });

        expect(updated).toBeDefined();
        expect(updated!.firstName).toBe('Updated');
        expect((updated as any).events).toHaveLength(1);
        expect((updated as any).events[0].type).toBe('anniversary');
    });

    it('should delete a user and its events (cascade)', async () => {
        const user = await repo.create({
            email: 'delete@example.com',
            firstName: 'Delete',
            lastName: 'Me',
            location: 'UTC',
            events: [{ type: 'birthday', eventDate: '1990-01-01' }]
        });
        expect(user).toBeDefined();

        await repo.delete(user!.id);

        const fetched = await repo.getById(user!.id);
        expect(fetched).toBeUndefined();

        // Check that events are also gone (though getById would return undefined anyway)
        const allEvents = await db.query.userEvents.findMany();
        expect(allEvents).toHaveLength(0);
    });
});

import { vi, describe, expect, it, beforeEach } from 'vitest';

const mockUserService = {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
};

// Use functions that return the instances for constructors
vi.mock('../service/user.service', () => ({
    UserService: function () { return mockUserService; }
}));

vi.mock('../repositories/user.repository', () => ({
    UserRepository: function () { return {}; }
}));

vi.mock('../db', () => ({
    getDb: vi.fn(() => ({}))
}));

import users from './users';

describe('User Route', () => {
    const mockEnv = { DB: {} as any };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /:id', () => {
        it('should return 200 and user data when user is found (Happy Path)', async () => {
            const mockUser = {
                id: '123',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                location: 'Asia/Jakarta',
                events: [
                    { type: 'birthday', eventDate: '1990-01-01' }
                ]
            };
            mockUserService.getById.mockResolvedValue(mockUser);

            const res = await users.request('/123', {}, mockEnv);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.data).toEqual(mockUser);
        });

        it('should return 404 when user is not found (Unhappy Path)', async () => {
            mockUserService.getById.mockResolvedValue(null);

            const res = await users.request('/unknown', {}, mockEnv);

            expect(res.status).toBe(404);
            const body = await res.json() as any;
            expect(body.message).toBe('User not found');
        });
    });

    describe('POST /', () => {
        const newUser = {
            email: 'jane@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            location: 'Asia/Jakarta',
            events: [
                { type: 'birthday', eventDate: '1995-12-25' }
            ]
        };

        it('should return 201 and created user (Happy Path)', async () => {
            const createdUser = { id: '456', ...newUser };
            mockUserService.create.mockResolvedValue(createdUser);

            const res = await users.request('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            }, mockEnv);

            expect(res.status).toBe(201);
            const body = await res.json() as any;
            expect(body.data).toEqual(createdUser);
        });
    });

    describe('DELETE /:id', () => {
        it('should return 200 on success (Happy Path)', async () => {
            mockUserService.delete.mockResolvedValue({ id: '123' });

            const res = await users.request('/123', { method: 'DELETE' }, mockEnv);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.message).toBe('User 123 deleted');
        });

        it('should return 404 if user not found (Unhappy Path)', async () => {
            mockUserService.delete.mockResolvedValue(null);

            const res = await users.request('/missing', { method: 'DELETE' }, mockEnv);

            expect(res.status).toBe(404);
        });
    });
});

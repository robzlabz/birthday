import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../index"; // Import the Hono app

// Mock DB and Repo
vi.mock("../db", () => ({
    createDb: vi.fn(() => ({})), // Return empty object
}));

vi.mock("../repositories/user.repository", () => ({
    UserRepository: vi.fn(),
}));

// Mock the UserService with a plain class to ensure constructor behavior works
vi.mock("../services/user.service", () => {
    return {
        UserService: class {
            createUser = vi.fn().mockResolvedValue({
                user: { id: "123", email: "test@example.com" },
                event: { nextNotifyAt: "2026-01-01T09:00:00Z" }
            });
            deleteUser = vi.fn().mockResolvedValue(true);
            updateUser = vi.fn().mockResolvedValue({
                user: { id: "123", firstName: "Updated" },
                event: { nextNotifyAt: "2026-01-01T09:00:00Z" }
            });
        }
    };
});

describe("User Routes", () => {
    it("should return 201 when creating a valid user", async () => {
        const res = await app.request("/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                birthDate: "1990-01-01",
                location: "Asia/Jakarta"
            })
        }, { DB: {} });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json).toHaveProperty("message", "User created successfully");
    });

    it("should return 400 when timezone is invalid", async () => {
        const res = await app.request("/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                birthDate: "1990-01-01",
                location: "Mars/Crater" // Invalid
            })
        }, { DB: {} });

        expect(res.status).toBe(400);
    });

    it("should return 400 when email is invalid", async () => {
        const res = await app.request("/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: "John",
                lastName: "Doe",
                email: "not-an-email",
                birthDate: "1990-01-01",
                location: "Asia/Jakarta"
            })
        }, { DB: {} });

        expect(res.status).toBe(400);
    });

    it("should return 200 when updating a user", async () => {
        const res = await app.request("/user/123", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: "John Updated",
                birthDate: "1990-01-01" // Required field
            })
        }, { DB: {} });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toHaveProperty("message", "User updated");
    });
});

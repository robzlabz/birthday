import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotificationService } from "./notification.service";
import { UserRepository } from "../repositories/user.repository";
import { EventRepository } from "../repositories/event.repository";
import { SchedulerService } from "./scheduler.service";

// Mock dependencies
vi.mock("../repositories/user.repository");
vi.mock("../repositories/event.repository");
vi.mock("./scheduler.service");

// Mock Fetch Global
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe("NotificationService", () => {
    let notificationService: NotificationService;
    let mockUserRepo: any;
    let mockEventRepo: any;

    beforeEach(() => {
        mockUserRepo = {
            findById: vi.fn(),
        };
        mockEventRepo = {
            findById: vi.fn(),
            updateSchedule: vi.fn(),
            logNotification: vi.fn(),
        };

        notificationService = new NotificationService(mockUserRepo, mockEventRepo);
        vi.clearAllMocks();
    });

    describe("processEvent", () => {
        it("should return FATAL if user not found", async () => {
            mockUserRepo.findById.mockResolvedValue(null);
            const result = await notificationService.processEvent({
                eventId: "e1",
                userId: "u1",
                type: "BIRTHDAY",
                version: 1
            });
            expect(result).toBe("FATAL");
        });

        it("should return RETRY if email API fails (fetch error)", async () => {
            mockUserRepo.findById.mockResolvedValue({
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                location: "UTC"
            });

            // Simulate Network Error
            mockFetch.mockRejectedValue(new Error("Network Error"));

            const result = await notificationService.processEvent({
                eventId: "e1",
                userId: "u1",
                type: "BIRTHDAY",
                version: 1
            });
            expect(result).toBe("RETRY");
        });

        it("should return RETRY if email API returns 500", async () => {
            mockUserRepo.findById.mockResolvedValue({
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                location: "UTC"
            });

            // Simulate 500
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Server Error"
            });

            const result = await notificationService.processEvent({
                eventId: "e1",
                userId: "u1",
                type: "BIRTHDAY",
                version: 1
            });
            expect(result).toBe("RETRY");
        });

        it("should return SUCCESS and update DB if email sent successfully", async () => {
            mockUserRepo.findById.mockResolvedValue({
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                location: "Asia/Jakarta"
            });

            // Mock Fetch Success
            mockFetch.mockResolvedValue({
                ok: true,
            });

            // Mock Event for Date Context
            mockEventRepo.findById.mockResolvedValue({
                id: "e1",
                date: "1990-01-01"
            });

            // Mock Scheduler
            const nextRun = new Date("2027-01-01T09:00:00Z");
            vi.spyOn(SchedulerService, "calculateNextRun").mockReturnValue(nextRun);

            const result = await notificationService.processEvent({
                eventId: "e1",
                userId: "u1",
                type: "BIRTHDAY",
                version: 1
            });

            expect(result).toBe("SUCCESS");

            // Verify Fetch called correctly
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("email-service.digitalenvision.com.au"),
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        email: "john@example.com",
                        message: "Hey, John Doe it’s your birthday"
                    })
                })
            );

            // Verify DB Updates
            expect(mockEventRepo.updateSchedule).toHaveBeenCalledWith("e1", nextRun, 1);
            expect(mockEventRepo.logNotification).toHaveBeenCalledWith(expect.objectContaining({
                userId: "u1",
                status: "SUCCESS"
            }));
        });

        it("should return FATAL if event not found during update (Data corruption)", async () => {
            mockUserRepo.findById.mockResolvedValue({
                email: "john@example.com",
                location: "UTC"
            });
            mockFetch.mockResolvedValue({ ok: true });

            // Event gone
            mockEventRepo.findById.mockResolvedValue(null);

            const result = await notificationService.processEvent({
                eventId: "e1",
                userId: "u1",
                type: "BIRTHDAY",
                version: 1
            });

            // Wait, logic says: if email sent but event not found, return FATAL or RETRY?
            // In code:
            // if (!fullEvent) return "FATAL";
            expect(result).toBe("FATAL");
        });
    });
});

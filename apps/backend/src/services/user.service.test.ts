import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "./user.service";
import { SchedulerService } from "./scheduler.service";
import { UserRepository } from "../repositories/user.repository";

// Mock dependencies
vi.mock("../repositories/user.repository");
vi.mock("./scheduler.service");

describe("UserService", () => {
    let userService: UserService;
    let mockUserRepo: any;

    beforeEach(() => {
        mockUserRepo = {
            createWithEvent: vi.fn(),
            delete: vi.fn(),
            updateWithEventReset: vi.fn(),
            findById: vi.fn(),
        } as unknown as UserRepository;

        userService = new UserService(mockUserRepo);
        vi.clearAllMocks();
    });

    describe("createUser", () => {
        it("should calculate next run and create user with event", async () => {
            const mockDate = new Date("2026-01-01T09:00:00Z");
            vi.spyOn(SchedulerService, "calculateNextRun").mockReturnValue(mockDate);

            // Fix: Return event with nextNotifyAt
            mockUserRepo.createWithEvent.mockResolvedValue({
                user: { id: "1" },
                event: { nextNotifyAt: mockDate.getTime() }
            });

            const payload = {
                firstName: "John",
                lastName: "Doe",
                email: "test@example.com",
                birthDate: "1990-01-01",
                location: "Asia/Jakarta"
            };

            await userService.createUser(payload);

            expect(SchedulerService.calculateNextRun).toHaveBeenCalledWith("1990-01-01", "Asia/Jakarta");
            expect(mockUserRepo.createWithEvent).toHaveBeenCalledWith(
                {
                    firstName: "John",
                    lastName: "Doe",
                    email: "test@example.com",
                    location: "Asia/Jakarta"
                },
                {
                    type: "BIRTHDAY",
                    date: "1990-01-01",
                    nextNotifyAt: mockDate.getTime()
                }
            );
        });
    });

    describe("updateUser", () => {
        it("should throw error if user not found", async () => {
            mockUserRepo.findById.mockResolvedValue(null);

            await expect(userService.updateUser("999", { firstName: "New" }))
                .rejects.toThrow("User not found");
        });

        it("should create new event if birthDate is updated", async () => {
            mockUserRepo.findById.mockResolvedValue({ location: "UTC" });
            const mockDate = new Date("2026-05-05T09:00:00Z");
            vi.spyOn(SchedulerService, "calculateNextRun").mockReturnValue(mockDate);

            // Fix: Mock return value
            mockUserRepo.updateWithEventReset.mockResolvedValue({
                user: { id: "123" },
                event: { nextNotifyAt: mockDate.getTime() }
            });

            await userService.updateUser("123", { birthDate: "1995-05-05" });

            expect(mockUserRepo.updateWithEventReset).toHaveBeenCalledWith(
                "123",
                {
                    firstName: undefined,
                    lastName: undefined,
                    location: "UTC"
                },
                {
                    type: "BIRTHDAY",
                    date: "1995-05-05",
                    nextNotifyAt: mockDate.getTime()
                }
            );
        });

        it("should use existing location if not provided in update", async () => {
            mockUserRepo.findById.mockResolvedValue({ location: "Asia/Tokyo" });
            const mockDate = new Date("2026-05-05T09:00:00Z");
            vi.spyOn(SchedulerService, "calculateNextRun").mockReturnValue(mockDate);

            // Fix: Mock return value
            mockUserRepo.updateWithEventReset.mockResolvedValue({
                user: { id: "123" },
                event: { nextNotifyAt: mockDate.getTime() }
            });

            // User provides birthDate but NO location. Should use "Asia/Tokyo"
            await userService.updateUser("123", { birthDate: "1995-05-05" });

            expect(SchedulerService.calculateNextRun).toHaveBeenCalledWith("1995-05-05", "Asia/Tokyo");
        });
    });

    describe("deleteUser", () => {
        it("should call repo delete", async () => {
            mockUserRepo.delete.mockResolvedValue(true);
            await userService.deleteUser("123");
            expect(mockUserRepo.delete).toHaveBeenCalledWith("123");
        });
    });
});

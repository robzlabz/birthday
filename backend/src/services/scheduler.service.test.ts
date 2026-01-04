import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SchedulerService } from "./scheduler.service";

describe("SchedulerService", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("calculateNextRun", () => {
        it("should schedule for same year if target time hasn't passed (Same TZ as UTC)", () => {
            // Mock: 2026-01-01 08:00 UTC
            vi.setSystemTime(new Date("2026-01-01T08:00:00Z"));

            // User: 2026-06-01 Birthday, UTC
            // Target: 2026-06-01 09:00 UTC
            const result = SchedulerService.calculateNextRun(
                "2000-06-01",
                "UTC"
            );

            expect(result.toISOString()).toBe("2026-06-01T09:00:00.000Z");
        });

        it("should schedule for today if 9am local hasn't passed", () => {
            // Mock: 2026-01-01 00:00 UTC
            // User: Jakarta (UTC+7). Local time: 07:00.
            vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

            // Birthday: 01-01
            // Target: 2026-01-01 09:00 Jakarta -> 02:00 UTC
            // Current UTC: 00:00. Target UTC: 02:00. (Future)
            const result = SchedulerService.calculateNextRun(
                "2000-01-01",
                "Asia/Jakarta"
            );

            expect(result.toISOString()).toBe("2026-01-01T02:00:00.000Z");
        });

        it("should schedule for next year if 9am local has passed", () => {
            // Mock: 2026-01-01 03:00 UTC
            // User: Jakarta (UTC+7). Local time: 10:00.
            vi.setSystemTime(new Date("2026-01-01T03:00:00Z"));

            // Birthday: 01-01 (Today)
            // Reference Target: 2026-01-01 09:00 Jakarta (Passed)
            // Expect Next Target: 2027-01-01 09:00 Jakarta

            const result = SchedulerService.calculateNextRun(
                "2000-01-01",
                "Asia/Jakarta"
            );

            // 2027-01-01 09:00 Jakarta -> 2027-01-01 02:00 UTC
            expect(result.toISOString()).toBe("2027-01-01T02:00:00.000Z");
        });

        it("should handle Leap Year birthday in Non-Leap Year (29 Feb -> 1 Mar)", () => {
            // Mock: 2025-01-01 (Non-Leap)
            vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

            // Birthday: 2000-02-29
            const result = SchedulerService.calculateNextRun(
                "2000-02-29",
                "Asia/Jakarta"
            );

            // Target: 2025-03-01 09:00 Jakarta -> 02:00 UTC
            expect(result.toISOString()).toBe("2025-03-01T02:00:00.000Z");
        });

        it("should handle Leap Year birthday in Leap Year (29 Feb -> 29 Feb)", () => {
            // Mock: 2028-01-01 (Leap)
            vi.setSystemTime(new Date("2028-01-01T00:00:00Z"));

            // Birthday: 2000-02-29
            const result = SchedulerService.calculateNextRun(
                "2000-02-29",
                "Asia/Jakarta"
            );

            // Target: 2028-02-29 09:00 Jakarta -> 02:00 UTC
            expect(result.toISOString()).toBe("2028-02-29T02:00:00.000Z");
        });

        it("should handle Far timezone (New York UTC-5)", () => {
            // Mock: 2026-01-01 12:00 UTC
            vi.setSystemTime(new Date("2026-01-01T12:00:00Z")); // 07:00 NY

            // Target: 2026-01-01 09:00 NY -> 14:00 UTC
            // Current UTC 12:00 < 14:00. Should schedule today.

            const result = SchedulerService.calculateNextRun(
                "2000-01-01",
                "America/New_York"
            );

            expect(result.toISOString()).toBe("2026-01-01T14:00:00.000Z");
        });
    });
});

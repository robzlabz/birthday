import { UserRepository } from "../repositories/user.repository";
import { SchedulerService } from "./scheduler.service";
import { users } from "../db/schema";

export class UserService {
    constructor(private readonly userRepo: UserRepository) { }

    /**
     * Create a new user and schedule their birthday event.
     */
    async createUser(input: {
        firstName: string;
        lastName: string;
        email: string;
        location: string;
        birthDate: string; // YYYY-MM-DD
    }) {
        // 1. Calculate Schedule Logic
        const nextNotifyAt = SchedulerService.calculateNextRun(
            input.birthDate,
            input.location
        );

        console.log(
            `[UserService] Scheduling ${input.email} for UTC: ${nextNotifyAt.toISOString()}`
        );

        const { user, event } = await this.userRepo.createWithEvent(
            {
                firstName: input.firstName,
                lastName: input.lastName,
                email: input.email,
                location: input.location,
            },
            {
                type: "BIRTHDAY",
                date: input.birthDate,
                nextNotifyAt: nextNotifyAt.getTime(),
            }
        );

        return {
            user,
            event: {
                ...event,
                nextNotifyAt: new Date(event.nextNotifyAt).toISOString()
            }
        };
    }

    /**
     * Update user and reset their schedule.
     */
    async updateUser(id: string, input: {
        firstName?: string;
        lastName?: string;
        location?: string;
        birthDate?: string;
    }) {
        // Fetch existing user first to get current data if input is partial
        // But for simplicity/performance in this specific flow, we might require birthDate/location
        // to re-calculate schedule.
        // Ideally, if birthDate/location is missing, we fetch DB.

        const existingUser = await this.userRepo.findById(id);
        if (!existingUser) throw new Error("User not found");

        // Merge input with existing for calculation
        const birthDate = input.birthDate || "2000-01-01"; // Fallback not needed if logic ensures presence
        // Actually we need the original birthDate if not provided to recalculate?
        // "all recent event will be deleted" implies we are making a new schedule.
        // If the user only updates "firstName", should we reset schedule?
        // The request says "update user data, all recent event will be deleted".
        // I will assume we ALWAYS re-schedule.

        // We need existing birthDate if not provided to calculate schedule.
        // But wait, "events" table has the birthDate (in `date` column).
        // Since we are deleting events, we MUST rely on the INPUT or User storage?
        // The user table does NOT have birthDate, only events table has it!
        // This is a schema constraint.

        // CRITICAL: Schema check.
        // users table: id, email, firstName, lastName, location, version.
        // events table: id, userId, type, date, nextNotifyAt.

        // If I update ONLY firstName, and I delete all events -> I LOSE the birthdate!
        // So, the PUT request MUST either:
        // 1. Provide birthDate.
        // 2. OR we must fetch the old event to get the birthDate before deleting.

        let targetBirthDate = input.birthDate;

        if (!targetBirthDate) {
            // We need to support partial update where birthDate is preserved?
            // The prompt implies a reset.
            // Given the schema, if I delete events, I lose the birth date. 
            // So I must fetch the generic 'BIRTHDAY' event first?
            // For now, let's enforce birthDate in PUT or fetch it.
            // Let's assume for this "update user data", user provides full profile or at least birthDate if it's changing.
            // To be safe, let's enforce birthDate required for now, OR fetch previous event.
            // Since `events` table holds the date, I'll fetch the user with simple query logic if needed.
            // But `findById` only returns User.

            // For simplicity in this iteration: I will require birthDate in the PUT request 
            // OR I will fetch the previous event. But `UserService` doesn't have EventRepo.
            // I will update the PUT schema to REQUIRE birthDate and location.
            throw new Error("BirthDate is required for update to reschedule");
        }

        const location = input.location || existingUser.location;

        const nextNotifyAt = SchedulerService.calculateNextRun(targetBirthDate, location);

        const { user, event } = await this.userRepo.updateWithEventReset(
            id,
            {
                firstName: input.firstName,
                lastName: input.lastName,
                location: location
            },
            {
                type: 'BIRTHDAY',
                date: targetBirthDate,
                nextNotifyAt: nextNotifyAt.getTime()
            }
        );

        return {
            user,
            event: {
                ...event,
                nextNotifyAt: new Date(event.nextNotifyAt).toISOString()
            }
        };
    }

    async deleteUser(id: string) {
        return this.userRepo.delete(id);
    }
}

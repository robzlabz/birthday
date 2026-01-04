import { UserRepository } from "../repositories/user.repository";
import { EventRepository } from "../repositories/event.repository";
import { SchedulerService } from "./scheduler.service";

export class NotificationService {
    private readonly API_URL =
        "https://email-service.digitalenvision.com.au/send-email";

    constructor(
        private readonly userRepo: UserRepository,
        private readonly eventRepo: EventRepository
    ) { }

    /**
     * Process the notification: Send Email -> Update Schedule -> Log
     * Returns:
     *  - 'SUCCESS': Email sent, DB updated.
     *  - 'RETRY': Temporary error (network, API 500).
     *  - 'FATAL': Data error (user not found), should not retry.
     */
    async processEvent(payload: {
        eventId: string;
        userId: string;
        type: string;
        version: number;
    }): Promise<"SUCCESS" | "RETRY" | "FATAL"> {
        const { eventId, userId, type, version } = payload;

        // 1. Fetch Context
        const user = await this.userRepo.findById(userId);
        if (!user) return "FATAL";

        // 2. Send Email
        const sent = await this.sendEmail(user, type);
        if (!sent) return "RETRY";

        // 3. Post-Process (Update Schedule & Log)
        try {
            // Fetch full event for date context (Using Repository now)
            const fullEvent = await this.eventRepo.findById(eventId);

            if (!fullEvent) return "FATAL";

            const nextRun = SchedulerService.calculateNextRun(
                fullEvent.date,
                user.location
            );

            await this.eventRepo.updateSchedule(eventId, nextRun, version);

            await this.eventRepo.logNotification({
                userId,
                type,
                status: "SUCCESS",
                sentAt: new Date(),
            });

            console.log(
                `[NotificationService] Event ${eventId} processed. Next: ${nextRun.toISOString()}`
            );
            return "SUCCESS";

        } catch (e) {
            console.error("[NotificationService] Database Error after sending email:", e);
            return "RETRY";
        }
    }

    private async sendEmail(user: { firstName: string, lastName: string, email: string, location: string }, type: string): Promise<boolean> {
        const fullName = `${user.firstName} ${user.lastName}`;
        const message = `Hey, ${fullName} it’s your birthday`;

        console.log(
            `[NotificationService] Sending to ${user.email} (${user.location})...`
        );

        try {
            const response = await fetch(this.API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: user.email,
                    message: message,
                }),
            });

            if (!response.ok) {
                console.warn(
                    `[NotificationService] API Error: ${response.status} ${response.statusText}`
                );
                return false;
            }

            return true;
        } catch (error) {
            console.error(`[NotificationService] Network/Timeout Error:`, error);
            return false;
        }
    }
}

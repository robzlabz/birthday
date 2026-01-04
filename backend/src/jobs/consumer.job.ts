import { createDb } from "../db";
import { EventRepository } from "../repositories/event.repository";
import { NotificationService } from "../services/notification.service";
import { UserRepository } from "../repositories/user.repository";
import { SchedulerService } from "../services/scheduler.service";

export async function consumerJob(
    batch: MessageBatch<any>,
    env: CloudflareBindings
) {
    const db = createDb(env.DB);
    const eventRepo = new EventRepository(db);
    const userRepo = new UserRepository(db);
    const notificationService = new NotificationService(userRepo);

    console.log(
        `[Queue] Processing batch of ${batch.messages.length} messages.`
    );

    for (const message of batch.messages) {
        const { eventId, userId, type, currentNotifyAt, version } = message.body;

        try {
            // 1. Process Notification
            const success = await notificationService.sendEmail({
                userId,
                type,
                eventId,
            });

            if (success) {
                // 2. Update Next Schedule
                const eventRecord = (await eventRepo.findPendingEvents(1)).find(
                    (e) => e.id === eventId
                );

                // Fetch full event to get 'date' context
                const fullEvent = await db.query.events.findFirst({
                    where: (events, { eq }) => eq(events.id, eventId),
                });

                if (!fullEvent) {
                    message.ack(); // Data gone? Ack to remove.
                    continue;
                }

                // We need user location.
                const user = await userRepo.findById(userId);
                if (!user) {
                    message.ack();
                    continue;
                }

                const nextRun = SchedulerService.calculateNextRun(
                    fullEvent.date,
                    user.location
                );

                // 3. Update DB (Optimistic Lock)
                await eventRepo.updateSchedule(eventId, nextRun, version);

                console.log(
                    `[Queue] Processed Event ${eventId}. Next run: ${nextRun.toISOString()}`
                );
                message.ack();
            } else {
                // Failed to send? Retry logic is handled by Queue (if we don't ack).
                // But if it's a permanent error (user not found), Ack it.
                message.retry();
            }
        } catch (e) {
            console.error(`[Queue] Error processing message ${message.id}`, e);
            message.retry();
        }
    }
}

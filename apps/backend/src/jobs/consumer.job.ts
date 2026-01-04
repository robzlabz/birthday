import { createDb } from "../db";
import { EventRepository } from "../repositories/event.repository";
import { NotificationService } from "../services/notification.service";
import { UserRepository } from "../repositories/user.repository";

export async function consumerJob(
    batch: MessageBatch<any>,
    env: CloudflareBindings
) {
    const db = createDb(env.DB);
    const eventRepo = new EventRepository(db);
    const userRepo = new UserRepository(db);
    const notificationService = new NotificationService(userRepo, eventRepo);

    console.log(
        `[Queue] Processing batch of ${batch.messages.length} messages.`
    );

    for (const message of batch.messages) {
        const { eventId, userId, type, version } = message.body;

        if (!userId) {
            console.error(`[Queue] Invalid Message (Missing userId): ${message.id}. Dropping.`);
            message.ack();
            continue;
        }

        try {
            const result = await notificationService.processEvent({
                eventId,
                userId,
                type,
                version,
            });

            switch (result) {
                case "SUCCESS":
                case "FATAL": // For now we Ack FATAL to remove from queue
                    message.ack();
                    break;
                case "RETRY":
                    message.retry({ delaySeconds: 60 }); // Exponential backoff handled by Cloudflare usually, but explicit delay helps
                    break;
            }
        } catch (e) {
            console.error(`[Queue] Unexpected Error processing message ${message.id}`, e);
            message.retry({ delaySeconds: 60 });
        }
    }
}

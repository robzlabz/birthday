import { createDb } from "../db";
import { EventRepository } from "../repositories/event.repository";

export async function producerJob(
    env: CloudflareBindings,
) {
    const db = createDb(env.DB);
    const eventRepo = new EventRepository(db);

    console.log("[Cron] Checking for pending events...");

    // Find events due now or in the past
    // Limit to batch size to avoid memory issues (e.g. 1000)
    const pendingEvents = await eventRepo.findPendingEvents(100);

    if (pendingEvents.length === 0) {
        console.log("[Cron] No pending events.");
        return;
    }

    console.log(
        `[Cron] Found ${pendingEvents.length} pending events. Enqueuing...`
    );

    // Batch send to Queue
    const messages = pendingEvents.map((evt) => ({
        body: {
            eventId: evt.id,
            userId: evt.userId,
            type: evt.type,
            currentNotifyAt: evt.nextNotifyAt, // Pass this for verification/optimistic locking
            version: evt.version,
        },
    }));

    await env.EMAIL_QUEUE.sendBatch(messages);
    console.log("[Cron] Done enqueuing.");
}

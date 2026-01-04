import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import usersRoute from "./routes/users";
import timezoneRoute from "./routes/timezone";
import { EventService } from "./service/event.service";
import { EmailService } from "./service/email.service";
import { requestId } from "hono/request-id";
import { DELAY_SECONDS } from "./constant/constant";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(cors())
app.use(logger())
app.use(requestId())

app.get("/", (c) => {
  return c.json({ message: "Test" })
})

app.route("/users", usersRoute);
app.route("/timezones", timezoneRoute);

app.notFound((c) => {
  return c.json({ message: "Not Found" }, 404)
})

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<any>, env: CloudflareBindings): Promise<void> {
    console.log(`[Queue] Processing batch of ${batch.messages.length} messages from ${batch.queue}`);
    const emailService = new EmailService(env.DB);

    for (const message of batch.messages) {
      try {
        await emailService.sendEventMessage(message.body);
        message.ack();
      } catch (error) {
        message.retry({ delaySeconds: DELAY_SECONDS });
        console.error(`[Queue] Failed to process message ${message.id}:`, error);
      }
    }
  },
  async scheduled(event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext): Promise<void> {
    console.log("Cron job triggered", event.cron);
    const eventService = new EventService(env.DB, env.BIRTHDAY_CHECK_QUEUE);
    ctx.waitUntil(eventService.checkAndQueue());
  },
};

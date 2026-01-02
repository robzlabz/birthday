import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import usersRoute from "./routes/users";
import timezoneRoute from "./routes/timezone";
import { BirthdayService } from "./service/birthday.service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(cors())
app.use(logger())

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
  async queue(batch: MessageBatch, env: CloudflareBindings): Promise<void> {
    console.log("Queue message received", batch);
  },
  async scheduled(event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext): Promise<void> {
    console.log("Cron job triggered", event.cron);
    const birthdayService = new BirthdayService(env.DB, env.BIRTHDAY_CHECK_QUEUE);
    ctx.waitUntil(birthdayService.checkAndQueue());
  },
};

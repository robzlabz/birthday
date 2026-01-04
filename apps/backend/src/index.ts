import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import userRoutes from "./routes/user.routes";
import { producerJob } from "./jobs/producer.job";
import { consumerJob } from "./jobs/consumer.job";
import { createDb } from "./db";
import { EventRepository } from "./repositories/event.repository";
import { UserRepository } from "./repositories/user.repository";
import { email } from "zod";

const app = new Hono<{ Bindings: CloudflareBindings }>();
export { app };

app.use("*", logger());
app.use("*", cors());

app.route("/user", userRoutes);

// TODO: Add route here to manually trigger the producer job
app.get("/manual-trigger", async (c) => {
  await producerJob(c.env);
  return c.json({ message: "Manual trigger successful" });
});

// TODO: Add route here to send manual birthday event
app.get("/manual-trigger-event", async (c) => {
  // Create User and event (must be happend in past)
  const eventId = crypto.randomUUID();
  const userId = "";
  const db = createDb(c.env.DB);
  // create user
  const userCtx = {
    id: userId,
    email: "john.doe@example.com",
    firstName: "John",
    lastName: "Doe",
    location: "Asia/Jakarta",
  };
  const eventCtx = {
    id: eventId,
    date: new Date().toISOString(),
    type: "birthday",
    notifyAt: new Date(),
    nextNotifyAt: Date.now(),
    version: 1,
  };
  const userRepo = new UserRepository(db);
  await userRepo.createWithEvent(userCtx, eventCtx);

  c.env.EMAIL_QUEUE.send({
    body: {
      eventId,
      userId,
      type: "birthday",
      notifyAt: eventCtx.notifyAt,
      nextNotifyAt: eventCtx.nextNotifyAt,
      version: eventCtx.version,
    },
  });
  return c.json({ message: "Manual event trigger successful" });
});

export default {
  fetch: app.fetch,

  // 1. CRON TRIGGER (The Producer)
  async scheduled(
    event: ScheduledEvent,
    env: CloudflareBindings,
    ctx: ExecutionContext
  ) {
    await producerJob(env);
  },

  // 2. QUEUE CONSUMER (The Consumer)
  async queue(batch: MessageBatch<any>, env: CloudflareBindings) {
    await consumerJob(batch, env);
  }
};

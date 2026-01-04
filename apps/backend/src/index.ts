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

// JUST FOR TEST: Add route here to manually trigger the producer job
app.get("/manual-trigger", async (c) => {
  // create 100 user and event that happend in past, then call queue
  const db = createDb(c.env.DB);
  const userRepo = new UserRepository(db);
  const tasks = [];

  const now = Date.now();

  for (let i = 0; i < 100; i++) {
    // Randomize date to avoid all being exactly same millisecond if relevant
    const pastTime = now - (1000 * 60 * 60 * 24); // 1 day ago

    tasks.push(
      userRepo.createWithEvent(
        {
          email: `cron_test_${now}_${i}@example.com`,
          firstName: `CronUser`,
          lastName: `${i}`,
          location: "Asia/Jakarta",
        },
        {
          type: "BIRTHDAY",
          date: "1990-01-01",
          nextNotifyAt: pastTime, // Pending!
        }
      )
    );
  }

  // Execute inserts in parallel
  // D1/SQLite might lock, but let's try Promise.all. If it fails, we switch to sequential.
  // Given it's a test route, parallelism is better for speed.
  await Promise.all(tasks);

  await producerJob(c.env);
  return c.json({ message: "Manual trigger successful. Created 100 pending events and triggered producer." });
});

// JUST FOR TEST: Add route here to send manual birthday event
app.get("/manual-trigger-event", async (c) => {
  // Create User and event (must be happend in past)
  const db = createDb(c.env.DB);

  // create user
  const userCtx = {
    email: `john.doe.${Date.now()}@example.com`, // Unique email to avoid unique constraint error
    firstName: "John",
    lastName: "Doe",
    location: "Asia/Jakarta",
  };

  const eventCtx = {
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    type: "birthday",
    nextNotifyAt: Date.now(),
    version: 1,
  };

  const userRepo = new UserRepository(db);
  // Capture the ACTUAL created user and event with generated IDs
  const { user, event } = await userRepo.createWithEvent(userCtx, eventCtx);

  await c.env.EMAIL_QUEUE.send({
    eventId: event.id,
    userId: user.id,
    type: event.type,
    currentNotifyAt: event.nextNotifyAt, // Use key expected by consumer
    version: event.version,
  });

  return c.json({
    message: "Manual event trigger successful",
    user: { ...user, event: { ...event } },
  });
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

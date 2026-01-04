import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import userRoutes from "./routes/user.routes";
import { producerJob } from "./jobs/producer.job";
import { consumerJob } from "./jobs/consumer.job";

const app = new Hono<{ Bindings: CloudflareBindings }>();
export { app };

app.use("*", logger());
app.use("*", cors());

app.route("/user", userRoutes);

export default {
  fetch: app.fetch,

  // 1. CRON TRIGGER (The Producer)
  async scheduled(
    event: ScheduledEvent,
    env: CloudflareBindings,
    ctx: ExecutionContext
  ) {
    await producerJob(event, env, ctx);
  },

  // 2. QUEUE CONSUMER (The Consumer)
  async queue(batch: MessageBatch<any>, env: CloudflareBindings) {
    await consumerJob(batch, env);
  }
};

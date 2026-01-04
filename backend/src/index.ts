import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", logger());
app.use("*", cors());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createDb } from "../db";
import { UserRepository } from "../repositories/user.repository";
import { UserService } from "../services/user.service";
import { users } from "../db/schema";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Schema Validation
const CreateUserSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    location: z.string().refine((val) => {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: val });
            return true;
        } catch {
            return false;
        }
    }, "Invalid IANA Timezone"),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"), // YYYY-MM-DD
});

const UpdateUserSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    location: z.string().refine((val) => {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: val });
            return true;
        } catch {
            return false;
        }
    }, "Invalid IANA Timezone").optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"), // REQUIRED for now due to event reset logic
});

// Routes
app.post(
    "/",
    zValidator("json", CreateUserSchema),
    async (c) => {
        const body = c.req.valid("json");
        const db = createDb(c.env.DB);
        const userRepo = new UserRepository(db);
        const userService = new UserService(userRepo);

        try {
            const result = await userService.createUser(body);

            return c.json({
                message: "User created successfully",
                data: result
            }, 201);

        } catch (e) {
            console.error(e);
            return c.json({ error: "Failed to create user" }, 500);
        }
    }
);

app.put(
    "/:id",
    zValidator("json", UpdateUserSchema),
    async (c) => {
        const id = c.req.param("id");
        const body = c.req.valid("json");
        const db = createDb(c.env.DB);
        const userRepo = new UserRepository(db);
        const userService = new UserService(userRepo);

        try {
            const result = await userService.updateUser(id, body);
            return c.json({ message: "User updated", data: result });
        } catch (e: any) {
            console.error(e);
            return c.json({ error: e.message || "Failed to update user" }, 500);
        }
    }
);

app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const db = createDb(c.env.DB);
    const userRepo = new UserRepository(db);
    const userService = new UserService(userRepo);

    await userService.deleteUser(id);
    return c.json({ message: "User deleted" });
});

export default app;

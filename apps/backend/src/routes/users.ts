import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createUserSchema, updateUserSchema } from '../schema/user.schema';
import { UserService } from '../service/user.service';

const users = new Hono<{ Bindings: CloudflareBindings }>();

users.get('/', async (c) => {
    const userService = new UserService(c.env.DB);
    const allUsers = await userService.list();
    return c.json({ data: allUsers });
});

users.get('/:id', async (c) => {
    const id = c.req.param('id');
    const userService = new UserService(c.env.DB);
    const user = await userService.getById(id);
    if (!user) {
        return c.json({ message: 'User not found' }, 404);
    }
    return c.json({ data: user });
});

users.post('/', zValidator('json', createUserSchema), async (c) => {
    const body = c.req.valid('json');
    const userService = new UserService(c.env.DB);
    const newUser = await userService.create(body);
    return c.json({ message: 'User created', data: newUser }, 201);
});

users.put('/:id', zValidator('json', updateUserSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const userService = new UserService(c.env.DB);
    const updatedUser = await userService.update(id, body);
    if (!updatedUser) {
        return c.json({ message: 'User not found or update failed' }, 404);
    }
    return c.json({ message: `User ${id} updated`, data: updatedUser });
});

export default users;

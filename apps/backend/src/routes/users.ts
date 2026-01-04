import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createUserSchema, updateUserSchema } from '../schema';
import { UserService } from '../service/user.service';

const users = new Hono<{ Bindings: CloudflareBindings }>();


users.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const userService = new UserService(c.env.DB);
        const user = await userService.getById(id);
        if (!user) {
            return c.json({ message: 'User not found' }, 404);
        }
        return c.json({ data: user });
    } catch (error) {
        console.error(`Error fetching user ${c.req.param('id')}:`, error);
        return c.json({ message: 'Internal Server Error' }, 500);
    }
});

users.post('/', zValidator('json', createUserSchema), async (c) => {
    try {
        const body = c.req.valid('json');
        const userService = new UserService(c.env.DB);
        const newUser = await userService.create(body);
        return c.json({ message: 'User created', data: newUser }, 201);
    } catch (error) {
        console.error('Error creating user:', error);
        return c.json({ message: 'Internal Server Error' }, 500);
    }
});

users.put('/:id', zValidator('json', updateUserSchema), async (c) => {
    try {
        const id = c.req.param('id');
        const body = c.req.valid('json');
        const userService = new UserService(c.env.DB);
        const updatedUser = await userService.update(id, body);
        if (!updatedUser) {
            return c.json({ message: 'User not found or update failed' }, 404);
        }
        return c.json({ message: `User ${id} updated`, data: updatedUser });
    } catch (error) {
        console.error(`Error updating user ${c.req.param('id')}:`, error);
        return c.json({ message: 'Internal Server Error' }, 500);
    }
});

users.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const userService = new UserService(c.env.DB);
        const deletedUser = await userService.delete(id);
        if (!deletedUser) {
            return c.json({ message: 'User not found' }, 404);
        }
        return c.json({ message: `User ${id} deleted` });
    } catch (error) {
        console.error(`Error deleting user ${c.req.param('id')}:`, error);
        return c.json({ message: 'Internal Server Error' }, 500);
    }
});

export default users;

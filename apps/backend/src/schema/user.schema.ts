import { z } from 'zod';
import { eventSchema, DomainEvent } from './event.schema';

export const createUserSchema = z.object({
    email: z.email("Invalid email address"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    location: z.string().min(1, "Location is required"),
    events: z.array(eventSchema).optional(),
});

export const updateUserSchema = createUserSchema.partial();

export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export interface DomainUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    location: string;
    createdAt: Date;
    events?: DomainEvent[];
}

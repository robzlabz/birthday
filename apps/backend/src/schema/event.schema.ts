import { z } from 'zod';

export const eventSchema = z.object({
    type: z.enum(['birthday', 'anniversary']),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
});

export type UserEventModel = z.infer<typeof eventSchema>;

export interface DomainEvent {
    id: string;
    userId: string;
    type: 'birthday' | 'anniversary';
    eventDate: string;
    monthDay: string;
    createdAt: Date;
}

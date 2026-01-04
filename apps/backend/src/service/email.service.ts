import { EMAIL_API_URL } from '../constant/constant';
import { EventRepository } from '../repositories/event.repository';

export class EmailService {
    constructor(private repository: EventRepository) { }

    /**
     * Sends a birthday or anniversary message to the external API.
     * Implements deduplication and status tracking.
     */
    async sendEventMessage(data: {
        userId: string;
        eventId: string;
        firstName: string;
        lastName: string;
        email: string;
        eventType: 'birthday' | 'anniversary';
        processYear: number;
    }): Promise<void> {
        const log = await this.repository.getLogStatus(data.userId, data.eventId, data.processYear);
        if (log?.status === 'sent') {
            console.log(`[EmailService] Skipping already sent event: ${data.eventId} for user ${data.userId} in ${data.processYear}`);
            return;
        }

        const fullName = `${data.firstName} ${data.lastName}`;
        const message = this.getMessage(fullName, data.eventType);

        console.log(`[EmailService] Sending ${data.eventType} email to ${data.email}: "${message}"`);

        const response = await fetch(EMAIL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: data.email,
                message: message
            })
        });

        if (!response.ok) {
            await this.repository.updateLogStatus(data.userId, data.eventId, data.processYear, 'failed');
            throw new Error(`Failed to send email to ${data.email}`);
        }

        console.log(`[EmailService] Successfully sent to ${data.email}`);
        await this.repository.updateLogStatus(data.userId, data.eventId, data.processYear, 'sent');
    }

    private getMessage(fullName: string, eventType: 'birthday' | 'anniversary'): string {
        if (eventType === 'anniversary') {
            return `Hey, ${fullName} it's your anniversary!`;
        }
        return `Hey, ${fullName} it's your birthday`;
    }
}

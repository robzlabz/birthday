export class EmailService {
    private apiUrl = 'https://email-service.digitalenvision.com.au';

    /**
     * Sends a birthday or anniversary message to the external API.
     * Implements basic retry logic for robustness as per requirements.
     */
    async sendEventMessage(data: {
        firstName: string;
        lastName: string;
        email: string;
        eventType: 'birthday' | 'anniversary';
    }): Promise<void> {
        const fullName = `${data.firstName} ${data.lastName}`;
        const message = this.getMessage(fullName, data.eventType);

        console.log(`[EmailService] Sending ${data.eventType} email to ${data.email}: "${message}"`);

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: data.email,
                        message: message
                    })
                });

                if (response.ok) {
                    console.log(`[EmailService] Successfully sent to ${data.email}`);
                    return;
                }

                console.warn(`[EmailService] API returned status ${response.status}. Attempt ${attempts + 1}/${maxAttempts}`);
            } catch (error) {
                console.error(`[EmailService] Network/Timeout error on attempt ${attempts + 1}:`, error);
            }

            attempts++;
            if (attempts < maxAttempts) {
                // Simple backoff: 1s, 2s
                await new Promise(resolve => setTimeout(resolve, attempts * 1000));
            }
        }

        throw new Error(`Failed to send email to ${data.email} after ${maxAttempts} attempts`);
    }

    private getMessage(fullName: string, eventType: 'birthday' | 'anniversary'): string {
        if (eventType === 'anniversary') {
            return `Hey, ${fullName} it's your anniversary!`;
        }
        return `Hey, ${fullName} it's your birthday`;
    }
}

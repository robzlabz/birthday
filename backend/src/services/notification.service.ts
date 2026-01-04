import { UserRepository } from "../repositories/user.repository";

export class NotificationService {
    constructor(private readonly userRepo: UserRepository) { }

    async sendEmail(payload: { userId: string; type: string; eventId: string }) {
        // 1. Fetch User details
        const user = await this.userRepo.findById(payload.userId);
        if (!user) {
            console.error(`[NotificationService] User not found: ${payload.userId}`);
            return false;
        }

        // 2. Simulate API Call (e.g., SendGrid, Mailgun)
        const message = `Happy ${payload.type}, ${user.firstName}!`;

        console.log(`---------------------------------------------------`);
        console.log(`✉️ SENDING EMAIL TO: ${user.email}`);
        console.log(`Subject: Happy ${payload.type}!`);
        console.log(`Body: ${message}`);
        console.log(`---------------------------------------------------`);

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        return true;
    }
}

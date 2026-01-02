CREATE TABLE `user_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`event_date` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `sent_logs` ADD `event_id` text;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `birthday_date`;
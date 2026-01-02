CREATE TABLE `sent_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`year` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`birthday_date` text NOT NULL,
	`location` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "first_name", "last_name", "birthday_date", "location", "created_at") SELECT "id", "first_name", "last_name", "birthday_date", "location", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
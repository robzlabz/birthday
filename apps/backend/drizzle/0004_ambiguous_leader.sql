PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sent_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`year` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `user_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sent_logs`("id", "user_id", "event_id", "year", "status", "created_at") SELECT "id", "user_id", "event_id", "year", "status", "created_at" FROM `sent_logs`;--> statement-breakpoint
DROP TABLE `sent_logs`;--> statement-breakpoint
ALTER TABLE `__new_sent_logs` RENAME TO `sent_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_event_year_idx` ON `sent_logs` (`user_id`,`event_id`,`year`);--> statement-breakpoint
ALTER TABLE `user_events` ADD `month_day` text NOT NULL;--> statement-breakpoint
CREATE INDEX `location_month_day_idx` ON `user_events` (`month_day`);--> statement-breakpoint
CREATE INDEX `month_day_idx` ON `user_events` (`month_day`);
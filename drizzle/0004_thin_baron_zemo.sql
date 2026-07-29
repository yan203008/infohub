CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_owner_key_idx` ON `user_preferences` (`user_email`,`key`);
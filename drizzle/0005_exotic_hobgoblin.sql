CREATE TABLE `user_content_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`content_id` text NOT NULL,
	`state` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_content_states_owner_content_idx` ON `user_content_states` (`user_email`,`content_id`);
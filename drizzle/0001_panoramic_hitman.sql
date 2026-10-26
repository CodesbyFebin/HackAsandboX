CREATE TABLE `catalog_entries` (
	`url` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`seen` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`updated` text NOT NULL
);

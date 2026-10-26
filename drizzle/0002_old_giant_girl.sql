ALTER TABLE `records` ADD `deleted` text;--> statement-breakpoint
CREATE INDEX `records_owner_kind` ON `records` (`owner`,`kind`);--> statement-breakpoint
CREATE INDEX `records_kind_deleted` ON `records` (`kind`,`deleted`);
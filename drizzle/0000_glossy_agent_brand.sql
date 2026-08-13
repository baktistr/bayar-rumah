CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`thumb_name` text,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`original_name` text,
	`uploaded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `att_tx_idx` ON `attachments` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer,
	`before_json` text,
	`after_json` text,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`house_label` text NOT NULL,
	`original_amount` integer NOT NULL,
	`baseline_amount` integer NOT NULL,
	`baseline_date` text NOT NULL,
	`baseline_installment_no` integer DEFAULT 0 NOT NULL,
	`monthly_target` integer NOT NULL,
	`due_day_of_month` integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`installment_no` integer,
	`type` text DEFAULT 'CICILAN' NOT NULL,
	`status` text DEFAULT 'LUNAS' NOT NULL,
	`amount` integer NOT NULL,
	`period` text NOT NULL,
	`paid_at` text,
	`method` text DEFAULT 'TRANSFER' NOT NULL,
	`bank_note` text,
	`note` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tx_period_idx` ON `transactions` (`period`);--> statement-breakpoint
CREATE INDEX `tx_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `tx_deleted_idx` ON `transactions` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
CREATE TABLE `attendance_entries` (
	`session_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`primary_name_es` text NOT NULL,
	`primary_name_en` text NOT NULL,
	`secondary_name_es` text DEFAULT '' NOT NULL,
	`secondary_name_en` text DEFAULT '' NOT NULL,
	`country_code` text DEFAULT '' NOT NULL,
	`representation_kind` text NOT NULL,
	`attendance_status` text NOT NULL,
	`observer` integer DEFAULT false NOT NULL,
	`warnings_total` integer DEFAULT 0 NOT NULL,
	`warnings_active` integer DEFAULT 0 NOT NULL,
	`faults` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`session_id`, `participant_id`),
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_entries_status` ON `attendance_entries` (`attendance_status`);--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`committee_id` text NOT NULL,
	`committee_slug` text NOT NULL,
	`committee_name_es` text NOT NULL,
	`committee_name_en` text NOT NULL,
	`committee_abbreviation_es` text NOT NULL,
	`committee_abbreviation_en` text NOT NULL,
	`title` text NOT NULL,
	`topic_es` text DEFAULT '' NOT NULL,
	`topic_en` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`closed_at` text NOT NULL,
	`received_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`participant_count` integer NOT NULL,
	`checksum` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_sessions_committee_closed` ON `attendance_sessions` (`committee_id`,`closed_at`);--> statement-breakpoint
CREATE INDEX `idx_attendance_sessions_expires` ON `attendance_sessions` (`expires_at`);
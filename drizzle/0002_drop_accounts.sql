-- Remove accounts: one shared workspace, no login.
-- Hand-written: SQLite cannot DROP COLUMN on foreign-key columns, and dropping `users` with
-- foreign keys enabled would cascade-delete every project. Tables are rebuilt instead
-- (SQLite's documented 12-step procedure). Migrations run before foreign keys are enabled.
DROP TABLE IF EXISTS `sessions`;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`key` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "projects_dates" CHECK("__new_projects"."end_date" >= "__new_projects"."start_date")
);--> statement-breakpoint
INSERT INTO `__new_projects` (`id`, `name`, `description`, `key`, `start_date`, `end_date`, `created_at`, `updated_at`)
	SELECT `id`, `name`, `description`, `key`, `start_date`, `end_date`, `created_at`, `updated_at` FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE INDEX `projects_created_idx` ON `projects` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`test_case_id` text NOT NULL,
	`status` text NOT NULL,
	`environment` text,
	`notes` text,
	`executed_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_executions` (`id`, `project_id`, `test_case_id`, `status`, `environment`, `notes`, `executed_at`)
	SELECT `id`, `project_id`, `test_case_id`, `status`, `environment`, `notes`, `executed_at` FROM `executions`;--> statement-breakpoint
DROP TABLE `executions`;--> statement-breakpoint
ALTER TABLE `__new_executions` RENAME TO `executions`;--> statement-breakpoint
CREATE INDEX `executions_tc_idx` ON `executions` (`test_case_id`,`executed_at`);--> statement-breakpoint
CREATE INDEX `executions_project_idx` ON `executions` (`project_id`);--> statement-breakpoint
CREATE TABLE `__new_bugs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`test_case_id` text,
	`execution_id` text,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`steps_to_reproduce` text DEFAULT '[]' NOT NULL,
	`expected_result` text DEFAULT '' NOT NULL,
	`actual_result` text DEFAULT '' NOT NULL,
	`severity` text DEFAULT 'major' NOT NULL,
	`environment` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee_email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`execution_id`) REFERENCES `executions`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_bugs` (`id`, `project_id`, `test_case_id`, `execution_id`, `code`, `title`, `steps_to_reproduce`, `expected_result`, `actual_result`, `severity`, `environment`, `status`, `assignee_email`, `created_at`, `updated_at`)
	SELECT `id`, `project_id`, `test_case_id`, `execution_id`, `code`, `title`, `steps_to_reproduce`, `expected_result`, `actual_result`, `severity`, `environment`, `status`, `assignee_email`, `created_at`, `updated_at` FROM `bugs`;--> statement-breakpoint
DROP TABLE `bugs`;--> statement-breakpoint
ALTER TABLE `__new_bugs` RENAME TO `bugs`;--> statement-breakpoint
CREATE UNIQUE INDEX `bugs_code_uq` ON `bugs` (`project_id`,`code`);--> statement-breakpoint
CREATE INDEX `bugs_project_idx` ON `bugs` (`project_id`,`created_at`);--> statement-breakpoint
DROP TABLE `users`;

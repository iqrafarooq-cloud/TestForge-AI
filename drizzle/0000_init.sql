CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `artifacts_project_idx` ON `artifacts` (`project_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE TABLE `bugs` (
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
	`reported_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`execution_id`) REFERENCES `executions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bugs_code_uq` ON `bugs` (`project_id`,`code`);--> statement-breakpoint
CREATE INDEX `bugs_project_idx` ON `bugs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `executions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`test_case_id` text NOT NULL,
	`status` text NOT NULL,
	`environment` text,
	`notes` text,
	`executed_by` text,
	`executed_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`executed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `executions_tc_idx` ON `executions` (`test_case_id`,`executed_at`);--> statement-breakpoint
CREATE INDEX `executions_project_idx` ON `executions` (`project_id`);--> statement-breakpoint
CREATE TABLE `phases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `phases_project_idx` ON `phases` (`project_id`,`position`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`key` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "projects_dates" CHECK("projects"."end_date" >= "projects"."start_date")
);
--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `requirement_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `requirement_sources_project_idx` ON `requirement_sources` (`project_id`);--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_id` text,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`criticality` text NOT NULL,
	`criticality_reason` text,
	`module` text,
	`acceptance_criteria` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `requirement_sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requirements_code_uq` ON `requirements` (`project_id`,`code`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `test_case_requirements` (
	`test_case_id` text NOT NULL,
	`requirement_id` text NOT NULL,
	`project_id` text NOT NULL,
	PRIMARY KEY(`test_case_id`, `requirement_id`),
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tcr_requirement_idx` ON `test_case_requirements` (`requirement_id`);--> statement-breakpoint
CREATE INDEX `tcr_project_idx` ON `test_case_requirements` (`project_id`);--> statement-breakpoint
CREATE TABLE `test_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`preconditions` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`expected_result` text NOT NULL,
	`priority` text NOT NULL,
	`type` text NOT NULL,
	`automation_score` integer NOT NULL,
	`automation_rationale` text,
	`test_data` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "test_cases_score" CHECK("test_cases"."automation_score" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `test_cases_code_uq` ON `test_cases` (`project_id`,`code`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`gemini_key_encrypted` text,
	`gemini_model` text,
	`jira_base_url` text,
	`jira_email` text,
	`jira_token_encrypted` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
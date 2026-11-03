CREATE TABLE `workspace_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`jira_base_url` text,
	`jira_email` text,
	`jira_token_encrypted` text,
	`updated_at` text NOT NULL
);

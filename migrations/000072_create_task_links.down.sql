-- Revert task_links table
DROP INDEX IF EXISTS idx_task_links_target;
DROP INDEX IF EXISTS idx_task_links_source;
DROP INDEX IF EXISTS idx_task_links_org;
DROP TABLE IF EXISTS task_links;

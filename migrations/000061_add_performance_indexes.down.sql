-- Remove performance indexes
DROP INDEX IF EXISTS idx_tasks_assignee_completed;
DROP INDEX IF EXISTS idx_tasks_assignee_dates;

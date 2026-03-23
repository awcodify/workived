-- Add performance query indexes for faster aggregation
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_completed ON tasks(assignee_id, completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_dates ON tasks(assignee_id, created_at, completed_at, due_date);

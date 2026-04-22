-- 000078_add_task_labels.up.sql
-- Add a built-in labels field to tasks table for tagging/categorization

ALTER TABLE tasks
    ADD COLUMN labels TEXT[] DEFAULT '{}';

COMMENT ON COLUMN tasks.labels IS 'Array of label strings for categorizing/filtering tasks (e.g. ["bug", "urgent", "frontend"])';

-- Index for efficient label search
CREATE INDEX idx_tasks_labels ON tasks USING GIN (labels);

-- 000078_add_task_labels.down.sql
-- Remove the labels field from tasks table

DROP INDEX IF EXISTS idx_tasks_labels;

ALTER TABLE tasks
    DROP COLUMN IF EXISTS labels;

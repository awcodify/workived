-- Revert task hierarchy columns
DROP INDEX IF EXISTS idx_tasks_hierarchy;
DROP INDEX IF EXISTS idx_tasks_parent;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_max_hierarchy_depth;
ALTER TABLE tasks DROP COLUMN IF EXISTS hierarchy_level;
ALTER TABLE tasks DROP COLUMN IF EXISTS parent_task_id;

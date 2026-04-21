-- Remove code column and index from tasks
DROP INDEX IF EXISTS idx_tasks_org_code;
ALTER TABLE tasks DROP COLUMN IF EXISTS code;

-- Remove task_sequence from organisations
ALTER TABLE organisations DROP COLUMN IF EXISTS task_sequence;

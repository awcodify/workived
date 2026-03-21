-- Remove approval metadata from tasks table

DROP INDEX IF EXISTS idx_tasks_approval;

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_approval_type_check;

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_approval_metadata_check;

ALTER TABLE tasks
DROP COLUMN IF EXISTS approval_id;

ALTER TABLE tasks
DROP COLUMN IF EXISTS approval_type;

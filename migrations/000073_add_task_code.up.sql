-- Add task sequence counter to organisations table
ALTER TABLE organisations ADD COLUMN task_sequence INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN organisations.task_sequence IS 'Sequence counter for generating task codes (e.g. WOR-123). Incremented atomically.';

-- Add code column to tasks table
ALTER TABLE tasks ADD COLUMN code VARCHAR(50);

-- Create unique constraint for code per organisation
CREATE UNIQUE INDEX idx_tasks_org_code ON tasks(organisation_id, code) WHERE code IS NOT NULL;

COMMENT ON COLUMN tasks.code IS 'Unique task code per organisation (e.g. WOR-123, AC-456). Generated from company initials + sequence number.';

-- Backfill existing tasks with codes
-- This will be handled in application code for better control over initials generation

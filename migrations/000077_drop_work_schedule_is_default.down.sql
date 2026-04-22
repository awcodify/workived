-- Restore is_default column to work_schedules

ALTER TABLE work_schedules ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_work_schedules_default ON work_schedules(organisation_id, is_default) WHERE is_default = TRUE;

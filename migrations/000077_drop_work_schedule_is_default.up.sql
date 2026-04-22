-- Remove is_default column from work_schedules
-- This column is no longer needed as all employees must have explicit schedule assignments

ALTER TABLE work_schedules DROP COLUMN IF EXISTS is_default;

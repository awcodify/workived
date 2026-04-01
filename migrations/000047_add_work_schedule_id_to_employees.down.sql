DROP INDEX IF EXISTS idx_employees_work_schedule;
ALTER TABLE employees DROP COLUMN IF EXISTS work_schedule_id;

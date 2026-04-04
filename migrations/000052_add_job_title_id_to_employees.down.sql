-- 000052_add_job_title_id_to_employees.down.sql
DROP INDEX IF EXISTS idx_employees_job_title;
ALTER TABLE employees DROP COLUMN IF EXISTS job_title_id;

-- 000047_add_reporting_to_employees.down.sql

DROP INDEX IF EXISTS idx_employees_reporting_to;
ALTER TABLE employees DROP COLUMN IF EXISTS reporting_to;

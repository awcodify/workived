-- 000048_add_employee_status_consistency_check.down.sql
DROP TRIGGER IF EXISTS trigger_sync_employee_is_active ON employees;
DROP FUNCTION IF EXISTS sync_employee_is_active();
ALTER TABLE employees DROP CONSTRAINT IF EXISTS check_employee_status_inactive_consistency;

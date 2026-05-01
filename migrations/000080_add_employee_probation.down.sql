DROP INDEX IF EXISTS idx_employees_probation;

ALTER TABLE employees DROP COLUMN IF EXISTS probation_end_date;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS check_employee_status_inactive_consistency;
ALTER TABLE employees ADD CONSTRAINT check_employee_status_inactive_consistency CHECK (
    (status = 'inactive' AND is_active = FALSE) OR
    (status != 'inactive' AND is_active = TRUE)
);

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check
    CHECK (status IN ('active', 'on_leave', 'probation', 'inactive'));

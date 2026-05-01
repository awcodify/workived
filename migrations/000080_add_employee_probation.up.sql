-- Probation is a time-bound period, not a status value.
-- Remove 'probation' from the status enum and introduce probation_end_date.
-- is_probation is derived: probation_end_date IS NOT NULL AND probation_end_date > CURRENT_DATE

-- Migrate existing probation employees to active before dropping the constraint.
UPDATE employees SET status = 'active' WHERE status = 'probation';

ALTER TABLE employees DROP CONSTRAINT employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check
    CHECK (status IN ('active', 'on_leave', 'inactive'));

-- Update the inactive consistency constraint to reference new status values.
ALTER TABLE employees DROP CONSTRAINT check_employee_status_inactive_consistency;
ALTER TABLE employees ADD CONSTRAINT check_employee_status_inactive_consistency CHECK (
    (status = 'inactive' AND is_active = FALSE) OR
    (status != 'inactive' AND is_active = TRUE)
);

ALTER TABLE employees ADD COLUMN probation_end_date DATE;

CREATE INDEX idx_employees_probation ON employees(organisation_id, probation_end_date)
    WHERE probation_end_date IS NOT NULL;

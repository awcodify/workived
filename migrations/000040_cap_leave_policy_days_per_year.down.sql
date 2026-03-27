-- Remove the CHECK constraint
ALTER TABLE leave_policies DROP CONSTRAINT IF EXISTS check_days_per_year_max;

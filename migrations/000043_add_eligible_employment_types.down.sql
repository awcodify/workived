DROP INDEX IF EXISTS idx_claim_categories_emp_types;
DROP INDEX IF EXISTS idx_leave_policies_emp_types;

ALTER TABLE claim_categories DROP COLUMN IF EXISTS eligible_employment_types;
ALTER TABLE leave_policies DROP COLUMN IF EXISTS eligible_employment_types;

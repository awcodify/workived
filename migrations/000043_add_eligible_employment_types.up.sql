-- Add eligible_employment_types column to leave_policies and claim_categories.
-- NULL means "all types eligible" (backward compatible).

ALTER TABLE leave_policies
    ADD COLUMN eligible_employment_types TEXT[];

ALTER TABLE claim_categories
    ADD COLUMN eligible_employment_types TEXT[];

-- GIN indexes for ANY() lookups
CREATE INDEX idx_leave_policies_emp_types
    ON leave_policies USING GIN (eligible_employment_types)
    WHERE eligible_employment_types IS NOT NULL;

CREATE INDEX idx_claim_categories_emp_types
    ON claim_categories USING GIN (eligible_employment_types)
    WHERE eligible_employment_types IS NOT NULL;

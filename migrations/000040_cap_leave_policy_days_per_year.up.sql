-- Cap any leave policies with days_per_year > 365 to 365
-- This fixes data created before the validation was tightened from 999 to 365
UPDATE leave_policies SET days_per_year = 365 WHERE days_per_year > 365;

-- Also add a CHECK constraint to prevent future violations
ALTER TABLE leave_policies ADD CONSTRAINT check_days_per_year_max CHECK (days_per_year <= 365);

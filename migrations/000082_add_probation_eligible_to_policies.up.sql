-- Controls whether employees currently in probation can use a leave policy or claim category.
-- DEFAULT TRUE = backward compatible (all existing policies remain open to probation employees).
ALTER TABLE leave_policies   ADD COLUMN probation_eligible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE claim_categories ADD COLUMN probation_eligible BOOLEAN NOT NULL DEFAULT TRUE;

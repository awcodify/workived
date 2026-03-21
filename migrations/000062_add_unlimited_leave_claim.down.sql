-- Remove unlimited leave/claim support

ALTER TABLE leave_policies DROP COLUMN IF EXISTS is_unlimited;
ALTER TABLE claim_categories DROP COLUMN IF EXISTS is_unlimited;

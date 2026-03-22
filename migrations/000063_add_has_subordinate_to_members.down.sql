-- Rollback has_subordinate column

DROP INDEX IF EXISTS idx_organisation_members_has_subordinate;
ALTER TABLE organisation_members DROP COLUMN IF EXISTS has_subordinate;

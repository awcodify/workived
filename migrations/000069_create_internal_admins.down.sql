-- Rollback: Drop internal_admins table

DROP INDEX IF EXISTS idx_internal_admins_user_id;
DROP TABLE IF EXISTS internal_admins;

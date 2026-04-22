-- 000074_add_auth_provider_to_users.down.sql

DROP INDEX IF EXISTS idx_users_auth_provider;

ALTER TABLE users DROP CONSTRAINT IF EXISTS check_email_auth_has_password;

-- First, update any NULL password_hash to a placeholder (before making it NOT NULL)
UPDATE users SET password_hash = 'oauth_user_no_password' WHERE password_hash IS NULL;

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS auth_provider;

DROP TYPE IF EXISTS auth_provider;

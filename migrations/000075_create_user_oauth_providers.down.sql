-- 000075_create_user_oauth_providers.down.sql

DROP TRIGGER IF EXISTS set_oauth_providers_updated_at ON user_oauth_providers;
DROP INDEX IF EXISTS idx_oauth_provider_user;
DROP INDEX IF EXISTS idx_oauth_user_id;
DROP TABLE IF EXISTS user_oauth_providers;

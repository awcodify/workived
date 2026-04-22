-- 000074_add_auth_provider_to_users.up.sql
-- Add auth_provider column to support OAuth authentication

-- Create enum for auth providers
CREATE TYPE auth_provider AS ENUM ('email', 'google', 'github', 'microsoft');

-- Add auth_provider column (default to 'email' for existing users)
ALTER TABLE users 
    ADD COLUMN auth_provider auth_provider NOT NULL DEFAULT 'email';

-- Make password_hash nullable (OAuth users don't have passwords)
ALTER TABLE users 
    ALTER COLUMN password_hash DROP NOT NULL;

-- Add constraint: if auth_provider is 'email', password_hash must be present
ALTER TABLE users
    ADD CONSTRAINT check_email_auth_has_password 
    CHECK (
        (auth_provider = 'email' AND password_hash IS NOT NULL) 
        OR 
        (auth_provider != 'email')
    );

-- Index for querying users by auth provider
CREATE INDEX idx_users_auth_provider ON users(auth_provider);

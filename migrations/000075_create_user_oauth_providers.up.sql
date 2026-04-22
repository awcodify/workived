-- 000075_create_user_oauth_providers.up.sql
-- Store OAuth provider connections and tokens

CREATE TABLE user_oauth_providers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            auth_provider NOT NULL,
    provider_user_id    VARCHAR(255) NOT NULL,  -- Google sub, GitHub ID, etc.
    provider_email      VARCHAR(255),            -- Email from provider
    access_token        TEXT,                    -- Encrypted OAuth access token
    refresh_token       TEXT,                    -- Encrypted OAuth refresh token
    token_expires_at    TIMESTAMPTZ,             -- When access token expires
    scope               TEXT,                    -- OAuth scopes granted
    profile_data        JSONB,                   -- Raw profile data from provider
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one provider per user
    CONSTRAINT unique_user_provider UNIQUE (user_id, provider),
    
    -- Ensure provider_user_id is unique per provider
    CONSTRAINT unique_provider_user UNIQUE (provider, provider_user_id)
);

-- Indexes
CREATE INDEX idx_oauth_user_id ON user_oauth_providers(user_id);
CREATE INDEX idx_oauth_provider_user ON user_oauth_providers(provider, provider_user_id);

-- Updated at trigger
CREATE TRIGGER set_oauth_providers_updated_at
    BEFORE UPDATE ON user_oauth_providers
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Comments
COMMENT ON TABLE user_oauth_providers IS 'OAuth provider connections for users';
COMMENT ON COLUMN user_oauth_providers.provider_user_id IS 'Unique identifier from OAuth provider (e.g., Google sub claim)';
COMMENT ON COLUMN user_oauth_providers.access_token IS 'OAuth access token (should be encrypted at rest)';
COMMENT ON COLUMN user_oauth_providers.profile_data IS 'Raw profile JSON from provider for debugging';

-- 000036_create_feature_flags.up.sql
-- Feature flags for gradual rollout and A/B testing.
-- Used by Workived internal team to control feature availability.

CREATE TABLE feature_flags (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key      VARCHAR(100) NOT NULL UNIQUE,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    is_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Scope: 'global' | 'org' | 'user'
    scope            VARCHAR(20) NOT NULL DEFAULT 'global' 
                         CHECK (scope IN ('global', 'org', 'user')),
    
    -- For org/user scoped flags, JSON array of IDs
    target_ids       JSONB,
    
    -- Metadata
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_key ON feature_flags(feature_key);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(is_enabled);

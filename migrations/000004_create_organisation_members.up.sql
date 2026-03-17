-- 000004_create_organisation_members.up.sql
CREATE TABLE organisation_members (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role             VARCHAR(20) NOT NULL DEFAULT 'member'
                         CHECK (role IN ('owner', 'admin', 'member')),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organisation_id, user_id)
);

CREATE INDEX idx_org_members_org ON organisation_members(organisation_id);
CREATE INDEX idx_org_members_user ON organisation_members(user_id);

CREATE TRIGGER set_org_members_updated_at
    BEFORE UPDATE ON organisation_members
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

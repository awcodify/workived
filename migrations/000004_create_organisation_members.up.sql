-- 000004_create_organisation_members.up.sql
CREATE TABLE organisation_members (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
    role             VARCHAR(20) NOT NULL DEFAULT 'member'
                         CHECK (role IN ('owner', 'admin', 'member', 'hr_admin', 'manager', 'finance', 'super_admin')),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    has_subordinate  BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organisation_id, user_id)
);

CREATE INDEX idx_org_members_org ON organisation_members(organisation_id);
CREATE INDEX idx_org_members_user ON organisation_members(user_id);
CREATE INDEX idx_org_members_employee ON organisation_members(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_organisation_members_has_subordinate ON organisation_members(organisation_id, has_subordinate) WHERE has_subordinate = TRUE;

CREATE TRIGGER set_org_members_updated_at
    BEFORE UPDATE ON organisation_members
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

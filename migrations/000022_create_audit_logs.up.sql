-- 000022_create_audit_logs.up.sql
-- Immutable — no updated_at, no soft delete.
CREATE TABLE audit_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    actor_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action           VARCHAR(100) NOT NULL,    -- e.g. employee.created, leave.approved
    resource_type    VARCHAR(50) NOT NULL,     -- e.g. employee, leave_request
    resource_id      UUID,
    before_state     JSONB,
    after_state      JSONB,
    ip_address       INET,
    request_id       VARCHAR(36),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_resource ON audit_logs(organisation_id, resource_type, resource_id);
CREATE INDEX idx_audit_actor        ON audit_logs(actor_user_id);

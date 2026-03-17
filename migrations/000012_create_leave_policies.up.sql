-- 000012_create_leave_policies.up.sql
CREATE TABLE leave_policies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    days_per_year     NUMERIC(5,1) NOT NULL,
    carry_over_days   NUMERIC(5,1) NOT NULL DEFAULT 0,
    min_tenure_days   INT NOT NULL DEFAULT 0,   -- eligibility threshold
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_policies_org ON leave_policies(organisation_id);

CREATE TRIGGER set_leave_policies_updated_at
    BEFORE UPDATE ON leave_policies
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

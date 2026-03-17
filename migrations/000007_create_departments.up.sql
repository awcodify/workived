-- 000007_create_departments.up.sql
CREATE TABLE departments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name             VARCHAR(150) NOT NULL,
    parent_id        UUID REFERENCES departments(id) ON DELETE SET NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_org ON departments(organisation_id);

CREATE TRIGGER set_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

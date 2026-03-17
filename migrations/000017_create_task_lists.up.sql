-- 000017_create_task_lists.up.sql
CREATE TABLE task_lists (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    position         INT NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_lists_org ON task_lists(organisation_id);

CREATE TRIGGER set_task_lists_updated_at
    BEFORE UPDATE ON task_lists
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

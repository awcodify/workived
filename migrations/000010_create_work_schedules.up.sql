-- 000010_create_work_schedules.up.sql
CREATE TABLE work_schedules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    work_days        INT[] NOT NULL,          -- e.g. {1,2,3,4,5}
    start_time       TIME NOT NULL,           -- e.g. 09:00
    end_time         TIME NOT NULL,           -- e.g. 18:00
    is_default       BOOLEAN NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_schedules_org ON work_schedules(organisation_id);

CREATE TRIGGER set_work_schedules_updated_at
    BEFORE UPDATE ON work_schedules
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 000023_create_attendance_records.up.sql
CREATE TABLE attendance_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    clock_in_at      TIMESTAMPTZ NOT NULL,
    clock_out_at     TIMESTAMPTZ,
    clock_in_lat     NUMERIC(10,7),   -- Pro: GPS latitude
    clock_in_lng     NUMERIC(10,7),   -- Pro: GPS longitude
    clock_out_lat    NUMERIC(10,7),
    clock_out_lng    NUMERIC(10,7),
    is_late          BOOLEAN NOT NULL DEFAULT FALSE,
    note             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_org_emp_date ON attendance_records(organisation_id, employee_id, date DESC);
CREATE INDEX idx_attendance_org_date     ON attendance_records(organisation_id, date DESC);

CREATE TRIGGER set_attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

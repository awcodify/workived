-- 000060_create_task_field_values.up.sql
-- Stores actual custom field values for each task.
-- One row per (task_id, field_id) pair.
-- Only the column matching field_type should be non-null.
--
-- Column → field_type mapping:
--   value_text    → text, url
--   value_number  → number, rating
--   value_date    → date
--   value_boolean → boolean
--   value_json    → select (single string), multi_select (array of strings), employee (UUID string)

CREATE TABLE task_field_values (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES task_field_definitions(id) ON DELETE CASCADE,
    value_text      TEXT,
    value_number    BIGINT,
    value_date      DATE,
    value_boolean   BOOLEAN,
    value_json      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT task_field_values_unique UNIQUE (task_id, field_id)
);

CREATE INDEX idx_task_field_values_org   ON task_field_values(organisation_id);
CREATE INDEX idx_task_field_values_task  ON task_field_values(task_id);
CREATE INDEX idx_task_field_values_field ON task_field_values(field_id);

CREATE TRIGGER set_task_field_values_updated_at
    BEFORE UPDATE ON task_field_values
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

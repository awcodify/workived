-- 000059_create_task_field_definitions.up.sql
-- Stores custom field schemas per organisation.
-- Each org defines which custom fields appear on their tasks.
-- field_type drives which value_* column is used in task_field_values.

CREATE TABLE task_field_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    field_type      VARCHAR(20) NOT NULL CHECK (field_type IN (
                        'text', 'number', 'date', 'boolean',
                        'select', 'multi_select', 'url', 'employee', 'rating'
                    )),
    description     TEXT,
    -- For select/multi_select: JSON array of {value, label, color?}
    -- For employee: unused (null)
    -- For others: unused (null)
    options         JSONB,
    -- type-specific config: {min, max} for number/rating; {format} for date
    config          JSONB,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique active field name per org (case-insensitive)
CREATE UNIQUE INDEX idx_task_field_def_org_name
    ON task_field_definitions(organisation_id, lower(name))
    WHERE is_active = TRUE;

CREATE INDEX idx_task_field_def_org
    ON task_field_definitions(organisation_id);

CREATE TRIGGER set_task_field_definitions_updated_at
    BEFORE UPDATE ON task_field_definitions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

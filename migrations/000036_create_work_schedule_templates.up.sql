-- 000036_create_work_schedule_templates.up.sql
-- Work schedule templates for organization setup wizard
-- Templates are country-specific and pre-configured with common schedules

CREATE TABLE work_schedule_templates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code     CHAR(2) NOT NULL,
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    work_days        INT[] NOT NULL,  -- [1,2,3,4,5] = Mon-Fri, 1=Mon ... 7=Sun
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (country_code, name)
);

CREATE INDEX idx_work_schedule_templates_country ON work_schedule_templates(country_code);

COMMENT ON TABLE work_schedule_templates IS 'Pre-configured work schedule templates for organization setup wizard';
COMMENT ON COLUMN work_schedule_templates.work_days IS 'Array of weekday numbers: 1=Monday, 2=Tuesday, ..., 7=Sunday';
COMMENT ON COLUMN work_schedule_templates.sort_order IS 'Display order in UI (lower = higher priority)';

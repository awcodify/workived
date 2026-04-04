-- 000051_create_job_titles.up.sql
CREATE TABLE job_titles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name             VARCHAR(150) NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organisation_id, name)
);

CREATE INDEX idx_job_titles_org ON job_titles(organisation_id);

CREATE TRIGGER set_job_titles_updated_at
    BEFORE UPDATE ON job_titles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE job_titles IS 'Reference table for standardized job titles to replace free-text job_title field';
COMMENT ON COLUMN job_titles.name IS 'Job title name (e.g., "Software Engineer", "HR Manager"). Unique per organisation to prevent duplicates.';

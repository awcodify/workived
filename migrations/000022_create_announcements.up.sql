-- 000020_create_announcements.up.sql
CREATE TABLE announcements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    author_id        UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    title            VARCHAR(255) NOT NULL,
    body             TEXT NOT NULL,
    is_pinned        BOOLEAN NOT NULL DEFAULT FALSE,
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_org ON announcements(organisation_id);

CREATE TRIGGER set_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 000019_create_task_comments.up.sql
CREATE TABLE task_comments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    task_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id        UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    body             TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_comments_org  ON task_comments(organisation_id);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);

CREATE TRIGGER set_task_comments_updated_at
    BEFORE UPDATE ON task_comments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 000018_create_tasks.up.sql
CREATE TABLE tasks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    task_list_id     UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    title            VARCHAR(500) NOT NULL,
    description      TEXT,
    assignee_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_by       UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    priority         VARCHAR(10) NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date         DATE,
    position         INT NOT NULL DEFAULT 0,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_org_list ON tasks(organisation_id, task_list_id, position);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id, completed_at NULLS FIRST);

CREATE TRIGGER set_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

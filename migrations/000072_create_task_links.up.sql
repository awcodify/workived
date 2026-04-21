-- Create task_links table for task relationships (blocks, related to, etc.)
CREATE TABLE task_links (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    source_task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    link_type         VARCHAR(50) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,

    -- Prevent duplicate links
    UNIQUE(source_task_id, target_task_id, link_type),
    
    -- Prevent self-linking
    CONSTRAINT task_links_no_self_link CHECK (source_task_id != target_task_id),
    
    -- Validate link types
    CONSTRAINT task_links_valid_type CHECK (
        link_type IN ('blocks', 'blocked_by', 'related_to', 'duplicates', 'duplicate_of', 'follows', 'precedes')
    )
);

CREATE INDEX idx_task_links_org ON task_links(organisation_id);
CREATE INDEX idx_task_links_source ON task_links(source_task_id, link_type);
CREATE INDEX idx_task_links_target ON task_links(target_task_id, link_type);

COMMENT ON TABLE task_links IS 'Task-to-task relationships (blocks, related to, duplicates, etc.)';
COMMENT ON COLUMN task_links.link_type IS 'Type of relationship: blocks, blocked_by, related_to, duplicates, duplicate_of, follows, precedes';
COMMENT ON COLUMN task_links.source_task_id IS 'The task that initiates the relationship';
COMMENT ON COLUMN task_links.target_task_id IS 'The task that is the target of the relationship';

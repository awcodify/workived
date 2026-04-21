-- Add subtask hierarchy support to tasks
ALTER TABLE tasks ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN hierarchy_level INT NOT NULL DEFAULT 0;

-- Add index for efficient parent-child queries
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_hierarchy ON tasks(organisation_id, hierarchy_level, parent_task_id NULLS FIRST);

-- Add constraint to prevent excessive nesting (max 3 levels: 0, 1, 2)
ALTER TABLE tasks ADD CONSTRAINT tasks_max_hierarchy_depth CHECK (hierarchy_level >= 0 AND hierarchy_level <= 2);

COMMENT ON COLUMN tasks.parent_task_id IS 'Parent task ID for subtask hierarchy';
COMMENT ON COLUMN tasks.hierarchy_level IS 'Nesting level (0=root, 1=subtask, 2=sub-subtask). Max depth is 2.';

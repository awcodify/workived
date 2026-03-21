-- Add approval metadata columns to tasks table
-- These columns link tasks to approval workflows (leave requests, claims)

ALTER TABLE tasks
ADD COLUMN approval_type VARCHAR(20),  -- 'leave' | 'claim' | NULL
ADD COLUMN approval_id UUID;           -- FK to leave_requests.id or claims.id

-- Constraint: Both must be NULL or both must be NOT NULL
ALTER TABLE tasks
ADD CONSTRAINT tasks_approval_metadata_check CHECK (
    (approval_type IS NULL AND approval_id IS NULL) OR
    (approval_type IS NOT NULL AND approval_id IS NOT NULL)
);

-- Constraint: approval_type must be 'leave' or 'claim' if present
ALTER TABLE tasks
ADD CONSTRAINT tasks_approval_type_check CHECK (
    approval_type IS NULL OR approval_type IN ('leave', 'claim')
);

-- Index for querying approval tasks
CREATE INDEX idx_tasks_approval 
ON tasks(approval_type, approval_id) 
WHERE approval_type IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN tasks.approval_type IS 'Type of approval this task represents (leave, claim, or NULL for regular tasks)';
COMMENT ON COLUMN tasks.approval_id IS 'ID of the approval entity (leave_requests.id or claims.id)';

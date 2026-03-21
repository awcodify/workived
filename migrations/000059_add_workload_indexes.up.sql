-- 000059_add_workload_indexes.up.sql
-- Indexes to optimize workload intelligence query

-- Optimize task count queries by org + assignee + completion status
CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee_active 
    ON tasks(organisation_id, assignee_id, completed_at) 
    WHERE completed_at IS NULL;

-- Optimize leave overlap queries (approved leave)
-- Note: Date filtering happens at query time, not in index predicate
CREATE INDEX IF NOT EXISTS idx_leave_req_approved_active
    ON leave_requests(organisation_id, employee_id, start_date, end_date)
    WHERE status = 'approved';

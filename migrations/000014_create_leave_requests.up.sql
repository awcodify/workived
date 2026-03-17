-- 000014_create_leave_requests.up.sql
CREATE TABLE leave_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_policy_id  UUID NOT NULL REFERENCES leave_policies(id) ON DELETE RESTRICT,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    total_days       NUMERIC(5,1) NOT NULL,
    reason           TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by      UUID REFERENCES employees(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    review_note      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_req_org_status ON leave_requests(organisation_id, status);
CREATE INDEX idx_leave_req_employee   ON leave_requests(employee_id, status);

CREATE TRIGGER set_leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

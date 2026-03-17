-- 000024_composite_indexes.up.sql
-- Composite indexes added after all tables exist.

-- employees
CREATE INDEX IF NOT EXISTS idx_employees_org_active  ON employees(organisation_id, is_active);

-- leave
CREATE INDEX IF NOT EXISTS idx_leave_req_org_emp     ON leave_requests(organisation_id, employee_id);

-- claims
CREATE INDEX IF NOT EXISTS idx_claims_org_emp        ON claims(organisation_id, employee_id);

-- attendance
CREATE INDEX IF NOT EXISTS idx_att_org_emp_date      ON attendance_records(organisation_id, employee_id, date DESC);

-- 000024_composite_indexes.down.sql
DROP INDEX IF EXISTS idx_employees_org_active;
DROP INDEX IF EXISTS idx_leave_req_org_emp;
DROP INDEX IF EXISTS idx_claims_org_emp;
DROP INDEX IF EXISTS idx_att_org_emp_date;

-- 000030_add_employee_id_to_org_members.down.sql

DROP INDEX IF EXISTS idx_org_members_employee;
ALTER TABLE organisation_members DROP COLUMN IF EXISTS employee_id;

-- 000009_add_employee_link_to_members.down.sql
DROP INDEX IF EXISTS idx_organisation_members_has_subordinate;
DROP INDEX IF EXISTS idx_org_members_employee;

ALTER TABLE organisation_members
    DROP COLUMN IF EXISTS has_subordinate,
    DROP COLUMN IF EXISTS employee_id;

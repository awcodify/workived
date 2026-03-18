-- 000030_add_employee_id_to_org_members.up.sql
-- Links organisation_members to employees so we know which HR record
-- belongs to each member (nullable — not every member is an employee).

ALTER TABLE organisation_members
    ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX idx_org_members_employee ON organisation_members(employee_id)
    WHERE employee_id IS NOT NULL;

-- Backfill: link existing members to employees by matching user_id within same org.
UPDATE organisation_members om
SET employee_id = e.id
FROM employees e
WHERE e.organisation_id = om.organisation_id
  AND e.user_id = om.user_id
  AND e.is_active = TRUE;

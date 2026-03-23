-- 000009_add_employee_link_to_members.up.sql
-- Links organisation_members to employees so we know which HR record
-- belongs to each member (nullable — not every member is an employee).

ALTER TABLE organisation_members
    ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    ADD COLUMN has_subordinate BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_org_members_employee ON organisation_members(employee_id)
    WHERE employee_id IS NOT NULL;

CREATE INDEX idx_organisation_members_has_subordinate ON organisation_members(organisation_id, has_subordinate)
    WHERE has_subordinate = TRUE;

COMMENT ON COLUMN organisation_members.has_subordinate IS 'True if this member manages other employees (has direct reports). Maintained by application code when reporting_to changes.';

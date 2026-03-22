-- Add has_subordinate flag to organisation_members
-- This flag indicates if the member manages other employees (has direct reports)

ALTER TABLE organisation_members
ADD COLUMN has_subordinate BOOLEAN NOT NULL DEFAULT false;

-- Create index for performance
CREATE INDEX idx_organisation_members_has_subordinate ON organisation_members(organisation_id, has_subordinate)
WHERE has_subordinate = true;

-- Update existing members who have subordinates
UPDATE organisation_members om
SET has_subordinate = true
WHERE EXISTS (
    SELECT 1
    FROM employees manager
    JOIN employees subordinate ON subordinate.reporting_to = manager.id
    WHERE om.employee_id = manager.id
      AND subordinate.is_active = true
);

COMMENT ON COLUMN organisation_members.has_subordinate IS 'True if this member manages other employees (has direct reports). Maintained by application code when reporting_to changes.';

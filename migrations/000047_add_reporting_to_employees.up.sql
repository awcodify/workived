-- 000047_add_reporting_to_employees.up.sql
-- Add employee hierarchy via self-referencing foreign key

ALTER TABLE employees ADD COLUMN reporting_to UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Index for efficient "list direct reports" queries
CREATE INDEX idx_employees_reporting_to ON employees(reporting_to);

COMMENT ON COLUMN employees.reporting_to IS 'Manager this employee reports to (self-referencing FK). NULL = reports to nobody (typically owner/founder).';

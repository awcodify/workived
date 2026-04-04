-- 000050_create_employment_changes.up.sql
-- Employment change history (promotions, transfers, salary adjustments)
-- Immutable audit trail for HR compliance (INA labor records, UAE visa changes)

CREATE TABLE employment_changes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    change_type      VARCHAR(20) NOT NULL CHECK (change_type IN ('department', 'title', 'salary', 'status', 'employment_type')),
    old_value        TEXT,                     -- For string/UUID changes
    new_value        TEXT,                     -- For string/UUID changes
    old_salary       BIGINT,                   -- For salary changes (smallest currency unit)
    new_salary       BIGINT,                   -- For salary changes (smallest currency unit)
    currency_code    CHAR(3),                  -- IDR, AED, MYR, SGD
    effective_date   DATE NOT NULL,            -- When the change took effect
    reason           TEXT,                     -- Optional: promotion, transfer, cost of living, etc.
    changed_by       UUID REFERENCES users(id) ON DELETE SET NULL,  -- Who made the change
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employment_changes_employee ON employment_changes(employee_id, created_at DESC);
CREATE INDEX idx_employment_changes_org      ON employment_changes(organisation_id);
CREATE INDEX idx_employment_changes_type     ON employment_changes(change_type);

COMMENT ON TABLE employment_changes IS 'Immutable history of employee record changes for legal compliance and audit trail';
COMMENT ON COLUMN employment_changes.change_type IS 'Type of change: department, title, salary, status, employment_type';
COMMENT ON COLUMN employment_changes.old_value IS 'Previous value (for non-salary changes), stored as text';
COMMENT ON COLUMN employment_changes.new_value IS 'New value (for non-salary changes), stored as text';
COMMENT ON COLUMN employment_changes.old_salary IS 'Previous salary amount in smallest currency unit';
COMMENT ON COLUMN employment_changes.new_salary IS 'New salary amount in smallest currency unit';
COMMENT ON COLUMN employment_changes.effective_date IS 'Date when the change took effect (not necessarily when it was recorded)';

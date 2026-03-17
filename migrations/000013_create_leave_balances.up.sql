-- 000013_create_leave_balances.up.sql
CREATE TABLE leave_balances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_policy_id  UUID NOT NULL REFERENCES leave_policies(id) ON DELETE RESTRICT,
    year             INT NOT NULL,
    entitled_days    NUMERIC(5,1) NOT NULL,
    carried_over_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    used_days        NUMERIC(5,1) NOT NULL DEFAULT 0,
    pending_days     NUMERIC(5,1) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (employee_id, leave_policy_id, year)
);

CREATE INDEX idx_leave_balances_org    ON leave_balances(organisation_id);
CREATE INDEX idx_leave_bal_emp_year    ON leave_balances(employee_id, year);

CREATE TRIGGER set_leave_balances_updated_at
    BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

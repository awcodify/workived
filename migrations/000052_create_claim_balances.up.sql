-- 000053_create_claim_balances.up.sql
CREATE TABLE claim_balances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category_id      UUID NOT NULL REFERENCES claim_categories(id) ON DELETE RESTRICT,
    year             INT NOT NULL,
    month            INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    -- Spending tracking
    total_spent      BIGINT NOT NULL DEFAULT 0,  -- Smallest currency unit
    claim_count      INT NOT NULL DEFAULT 0,
    currency_code    CHAR(3) NOT NULL,
    
    -- Limit copied from category at balance creation
    monthly_limit    BIGINT,  -- NULL = no limit
    
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_balance_per_month UNIQUE (organisation_id, employee_id, category_id, year, month)
);

CREATE INDEX idx_claim_balances_org ON claim_balances(organisation_id);
CREATE INDEX idx_claim_balances_employee ON claim_balances(employee_id, year, month);
CREATE INDEX idx_claim_balances_category ON claim_balances(category_id);

CREATE TRIGGER set_claim_balances_updated_at
    BEFORE UPDATE ON claim_balances
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMENT ON TABLE claim_balances IS 'Monthly claim spending tracker per employee per category';
COMMENT ON COLUMN claim_balances.total_spent IS 'Total approved claims in smallest currency unit';
COMMENT ON COLUMN claim_balances.monthly_limit IS 'Limit copied from category. NULL = no limit';

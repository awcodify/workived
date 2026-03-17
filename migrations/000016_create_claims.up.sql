-- 000016_create_claims.up.sql
CREATE TABLE claims (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category_id      UUID NOT NULL REFERENCES claim_categories(id) ON DELETE RESTRICT,
    amount           BIGINT NOT NULL,         -- smallest currency unit
    currency_code    CHAR(3) NOT NULL,
    description      TEXT,
    receipt_url      TEXT,                    -- S3 key
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by      UUID REFERENCES employees(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    review_note      TEXT,
    claim_date       DATE NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_org_status ON claims(organisation_id, status);
CREATE INDEX idx_claims_employee   ON claims(employee_id);

CREATE TRIGGER set_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

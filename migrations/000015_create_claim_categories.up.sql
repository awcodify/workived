-- 000015_create_claim_categories.up.sql
CREATE TABLE claim_categories (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    monthly_limit    BIGINT,              -- Pro tier: NULL = no cap
    currency_code    CHAR(3),
    requires_receipt BOOLEAN NOT NULL DEFAULT TRUE,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claim_categories_org ON claim_categories(organisation_id);

CREATE TRIGGER set_claim_categories_updated_at
    BEFORE UPDATE ON claim_categories
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

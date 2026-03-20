-- 000049_create_claim_category_templates.up.sql
CREATE TABLE claim_category_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code        CHAR(2) NOT NULL,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    monthly_limit       BIGINT,
    currency_code       CHAR(3),
    requires_receipt    BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_monthly_limit_currency CHECK (
        (monthly_limit IS NULL AND currency_code IS NULL) OR 
        (monthly_limit IS NOT NULL AND currency_code IS NOT NULL)
    )
);

CREATE INDEX idx_category_templates_country ON claim_category_templates(country_code, sort_order);

COMMENT ON TABLE claim_category_templates IS 'Country-specific claim category templates for quick org setup';
COMMENT ON COLUMN claim_category_templates.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN claim_category_templates.monthly_limit IS 'Monthly limit in smallest currency unit (cents). NULL = no limit';
COMMENT ON COLUMN claim_category_templates.sort_order IS 'Display order in template list (1=first)';

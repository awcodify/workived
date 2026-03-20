-- 000043_create_leave_policy_templates.up.sql
CREATE TABLE leave_policy_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code            CHAR(2) NOT NULL,
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    entitled_days_per_year  NUMERIC(5,1) NOT NULL,
    is_carry_over_allowed   BOOLEAN NOT NULL DEFAULT FALSE,
    max_carry_over_days     NUMERIC(5,1),
    is_accrued              BOOLEAN NOT NULL DEFAULT FALSE,
    requires_approval       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order              INT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_carry_over CHECK (
        NOT is_carry_over_allowed OR max_carry_over_days IS NOT NULL
    )
);

CREATE INDEX idx_policy_templates_country ON leave_policy_templates(country_code, sort_order);

COMMENT ON TABLE leave_policy_templates IS 'Country-specific leave policy templates for quick org setup';
COMMENT ON COLUMN leave_policy_templates.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN leave_policy_templates.sort_order IS 'Display order in template list (1=first)';

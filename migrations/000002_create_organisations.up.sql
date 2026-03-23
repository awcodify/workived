-- 000002_create_organisations.up.sql
CREATE TABLE organisations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(255) NOT NULL,
    slug                 VARCHAR(100) NOT NULL UNIQUE,
    country_code         CHAR(2) NOT NULL,           -- ISO 3166-1 alpha-2 e.g. ID, AE
    timezone             VARCHAR(50) NOT NULL,        -- e.g. Asia/Jakarta
    currency_code        CHAR(3) NOT NULL,            -- IDR, AED, MYR, SGD
    work_days            INT[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Mon … 7=Sun
    plan                 VARCHAR(20) NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free', 'pro', 'enterprise')),
    plan_employee_limit  INT DEFAULT 25,              -- NULL = unlimited (Pro+)
    logo_url             TEXT,
    setup_completed_at   TIMESTAMPTZ,                 -- NULL = setup wizard pending
    setup_skipped        BOOLEAN NOT NULL DEFAULT FALSE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organisations_setup ON organisations(setup_completed_at) 
    WHERE setup_completed_at IS NULL;

COMMENT ON COLUMN organisations.setup_completed_at IS 'When organization setup wizard was completed. NULL = setup pending.';
COMMENT ON COLUMN organisations.setup_skipped IS 'True if user explicitly skipped setup wizard.';

CREATE TRIGGER set_organisations_updated_at
    BEFORE UPDATE ON organisations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

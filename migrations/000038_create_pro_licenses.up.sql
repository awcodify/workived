-- 000038_create_pro_licenses.up.sql
-- Pro license management for tracking trials and paid subscriptions.

CREATE TABLE pro_licenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id     UUID NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,
    
    -- License type: 'trial' | 'monthly' | 'annual'
    license_type        VARCHAR(20) NOT NULL 
                            CHECK (license_type IN ('trial', 'monthly', 'annual')),
    
    -- Status: 'active' | 'expired' | 'cancelled' | 'suspended'
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
    
    -- Limits
    max_employees       INT,  -- NULL = unlimited
    
    -- Dates
    starts_at           TIMESTAMPTZ NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    cancelled_at        TIMESTAMPTZ,
    
    -- Billing (for future integration)
    stripe_subscription_id  VARCHAR(255),
    stripe_customer_id      VARCHAR(255),
    
    -- Audit
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pro_licenses_org ON pro_licenses(organisation_id);
CREATE INDEX idx_pro_licenses_status ON pro_licenses(status);
CREATE INDEX idx_pro_licenses_expires ON pro_licenses(expires_at);

-- Trigger to update organisations.plan when license changes
CREATE OR REPLACE FUNCTION sync_org_plan_from_license()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND NEW.expires_at > NOW() THEN
        UPDATE organisations 
        SET plan = 'pro'
        WHERE id = NEW.organisation_id;
    ELSE
        UPDATE organisations 
        SET plan = 'free'
        WHERE id = NEW.organisation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_org_plan
AFTER INSERT OR UPDATE ON pro_licenses
FOR EACH ROW
EXECUTE FUNCTION sync_org_plan_from_license();

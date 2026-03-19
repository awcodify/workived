-- 000037_add_super_admin_role.up.sql
-- Add super_admin role for Workived internal team.
-- Super admins can access admin dashboard and manage system config.

-- Update organisation_members role check to include super_admin
ALTER TABLE organisation_members 
    DROP CONSTRAINT IF EXISTS organisation_members_role_check;

ALTER TABLE organisation_members
    ADD CONSTRAINT organisation_members_role_check 
    CHECK (role IN ('owner', 'admin', 'hr_manager', 'hr_staff', 'finance_manager', 'finance_staff', 'member', 'super_admin'));

-- Update invitations role check
ALTER TABLE invitations
    DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'member', 'hr_manager', 'hr_staff', 'finance_manager', 'finance_staff', 'super_admin'));

-- Create internal admin config table
CREATE TABLE admin_config (
    key              VARCHAR(100) PRIMARY KEY,
    value            JSONB NOT NULL,
    description      TEXT,
    updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial admin config
INSERT INTO admin_config (key, value, description) VALUES
    ('maintenance_mode', 'false', 'Enable maintenance mode - blocks all user access'),
    ('allow_free_signups', 'true', 'Allow new free tier signups'),
    ('max_free_tier_orgs', '1000', 'Maximum number of free tier organisations');

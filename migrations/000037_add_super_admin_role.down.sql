-- 000037_add_super_admin_role.down.sql
DROP TABLE IF EXISTS admin_config;

-- Restore original role constraints
ALTER TABLE organisation_members 
    DROP CONSTRAINT IF EXISTS organisation_members_role_check;

ALTER TABLE organisation_members
    ADD CONSTRAINT organisation_members_role_check 
    CHECK (role IN ('owner', 'admin', 'hr_manager', 'hr_staff', 'finance_manager', 'finance_staff', 'member'));

ALTER TABLE invitations
    DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'member', 'hr_manager', 'hr_staff', 'finance_manager', 'finance_staff'));

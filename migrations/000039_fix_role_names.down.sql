-- 000039_fix_role_names.down.sql
-- Restore the old role CHECK constraints from migration 037.

ALTER TABLE organisation_members
    DROP CONSTRAINT IF EXISTS organisation_members_role_check;

ALTER TABLE organisation_members
    ADD CONSTRAINT organisation_members_role_check
    CHECK (role IN ('owner', 'admin', 'hr_manager', 'hr_staff', 'finance_manager', 'finance_staff', 'member', 'super_admin'));

ALTER TABLE invitations
    DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'member', 'hr_manager', 'hr_staff', 'finance_manager', 'finance_staff', 'super_admin'));

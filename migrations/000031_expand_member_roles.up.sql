-- 000031_expand_member_roles.up.sql
-- Adds Pro-tier roles: hr_admin, manager, finance.
-- Free-tier roles remain: owner, admin, member.

ALTER TABLE organisation_members
    DROP CONSTRAINT IF EXISTS organisation_members_role_check;

ALTER TABLE organisation_members
    ADD CONSTRAINT organisation_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'hr_admin', 'manager', 'finance'));

-- Also allow new roles in invitations.
ALTER TABLE invitations
    DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'member', 'hr_admin', 'manager', 'finance'));

-- 000031_expand_member_roles.down.sql
-- Revert to original 3 roles. Will fail if rows use new roles — intentional safety.

ALTER TABLE invitations
    DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'member'));

ALTER TABLE organisation_members
    DROP CONSTRAINT IF EXISTS organisation_members_role_check;

ALTER TABLE organisation_members
    ADD CONSTRAINT organisation_members_role_check
    CHECK (role IN ('owner', 'admin', 'member'));

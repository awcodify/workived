-- 000010_add_employee_link_to_invitations.down.sql
ALTER TABLE invitations
    DROP COLUMN IF EXISTS employee_id;

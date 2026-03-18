-- 000032_add_employee_id_to_invitations.down.sql

ALTER TABLE invitations DROP COLUMN IF EXISTS employee_id;

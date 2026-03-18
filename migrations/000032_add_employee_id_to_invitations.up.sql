-- 000032_add_employee_id_to_invitations.up.sql
-- Allows an invitation to pre-link to an existing employee record.
-- When accepted, the employee.user_id is set automatically.

ALTER TABLE invitations
    ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

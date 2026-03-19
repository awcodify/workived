-- 000034_make_employee_email_nullable.down.sql
-- Restore NOT NULL — blank existing rows first to avoid constraint error.
UPDATE employees SET email = '' WHERE email IS NULL;
ALTER TABLE employees ALTER COLUMN email SET NOT NULL;

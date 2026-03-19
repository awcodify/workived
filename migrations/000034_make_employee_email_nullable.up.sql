-- 000034_make_employee_email_nullable.up.sql
-- Email is optional — employees who don't use the app don't need one.
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;

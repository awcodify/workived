-- 000048_add_unique_phone_to_employees.up.sql
-- Add partial unique index on phone per organisation (only when phone is provided)
CREATE UNIQUE INDEX idx_employees_org_phone_unique
    ON employees (organisation_id, phone)
    WHERE phone IS NOT NULL AND phone != '';

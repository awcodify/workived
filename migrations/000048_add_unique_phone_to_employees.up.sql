-- 000048_add_unique_phone_to_employees.up.sql
-- Deduplicate phone numbers: keep earliest employee, null out duplicates
WITH dupes AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY organisation_id, phone
               ORDER BY created_at ASC
           ) AS rn
    FROM employees
    WHERE phone IS NOT NULL AND phone != ''
)
UPDATE employees
SET phone = NULL
FROM dupes
WHERE employees.id = dupes.id AND dupes.rn > 1;

-- Now safe to add partial unique index
CREATE UNIQUE INDEX idx_employees_org_phone_unique
    ON employees (organisation_id, phone)
    WHERE phone IS NOT NULL AND phone != '';

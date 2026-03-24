-- Fix missing employee records for existing organization owners
-- Run this once to backfill employee records for users who registered before the fix

-- Step 1: Update existing employees to set user_id where it's NULL
UPDATE employees e
SET user_id = u.id
FROM organisation_members om
JOIN users u ON u.id = om.user_id
WHERE e.organisation_id = om.organisation_id
  AND e.id = om.employee_id
  AND e.user_id IS NULL
  AND om.role = 'owner';

-- Step 2: Create employee records for owners who don't have one
WITH new_employees AS (
    INSERT INTO employees (organisation_id, user_id, full_name, email, start_date, is_active)
    SELECT 
        om.organisation_id,
        om.user_id,
        u.full_name,
        u.email,
        CURRENT_DATE,
        TRUE
    FROM organisation_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.role = 'owner'
      AND NOT EXISTS (
          SELECT 1 FROM employees e 
          WHERE e.organisation_id = om.organisation_id 
            AND LOWER(e.email) = LOWER(u.email)
      )
    ON CONFLICT DO NOTHING
    RETURNING id, organisation_id, email
)
SELECT * FROM new_employees;

-- Step 3: Link employee_id to organisation_members for owners who have an employee but missing the link
UPDATE organisation_members om
SET employee_id = e.id
FROM employees e
WHERE om.organisation_id = e.organisation_id
  AND om.role = 'owner'
  AND om.employee_id IS NULL
  AND EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = om.user_id 
        AND LOWER(u.email) = LOWER(e.email)
  );

-- Show what was created/linked
SELECT 
    om.role,
    om.user_id,
    om.employee_id,
    e.full_name,
    e.email,
    e.start_date,
    e.created_at
FROM organisation_members om
JOIN employees e ON e.id = om.employee_id
WHERE om.role = 'owner'
ORDER BY e.created_at DESC
LIMIT 10;

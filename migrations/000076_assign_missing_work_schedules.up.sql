-- Assign work schedules to employees who don't have one
-- This is a one-time data migration before removing the default schedule fallback

-- For each organization, assign the first active schedule to employees without one
UPDATE employees e
SET work_schedule_id = (
    SELECT ws.id
    FROM work_schedules ws
    WHERE ws.organisation_id = e.organisation_id
      AND ws.is_active = TRUE
    ORDER BY ws.created_at ASC
    LIMIT 1
)
WHERE e.work_schedule_id IS NULL
  AND e.is_active = TRUE
  AND EXISTS (
    SELECT 1 
    FROM work_schedules ws 
    WHERE ws.organisation_id = e.organisation_id 
      AND ws.is_active = TRUE
  );

-- Log a warning for any organizations that have employees but no schedules
-- (This should not happen in practice, but good to check)
DO $$
DECLARE
    org_record RECORD;
    emp_count INT;
BEGIN
    FOR org_record IN 
        SELECT DISTINCT e.organisation_id, o.name as org_name
        FROM employees e
        JOIN organisations o ON o.id = e.organisation_id
        WHERE e.work_schedule_id IS NULL
          AND e.is_active = TRUE
          AND NOT EXISTS (
            SELECT 1 
            FROM work_schedules ws 
            WHERE ws.organisation_id = e.organisation_id 
              AND ws.is_active = TRUE
          )
    LOOP
        SELECT COUNT(*) INTO emp_count
        FROM employees
        WHERE organisation_id = org_record.organisation_id
          AND is_active = TRUE
          AND work_schedule_id IS NULL;
        
        RAISE WARNING 'Organisation "%" (%) has % active employees without work_schedule_id and no active work schedules', 
            org_record.org_name, 
            org_record.organisation_id, 
            emp_count;
    END LOOP;
END $$;

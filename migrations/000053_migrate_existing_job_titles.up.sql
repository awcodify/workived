-- 000053_migrate_existing_job_titles.up.sql
-- Deduplicate existing free-text job titles and create standardized records
-- Then link employees to those standardized job titles

-- Step 1: Create job_title records from distinct existing values
INSERT INTO job_titles (organisation_id, name, is_active, created_at, updated_at)
SELECT DISTINCT
    e.organisation_id,
    TRIM(e.job_title) AS name,
    TRUE AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM employees e
WHERE e.job_title IS NOT NULL
  AND TRIM(e.job_title) != ''
ON CONFLICT (organisation_id, name) DO NOTHING;

-- Step 2: Link employees to their standardized job titles
UPDATE employees e
SET job_title_id = jt.id
FROM job_titles jt
WHERE e.organisation_id = jt.organisation_id
  AND TRIM(e.job_title) = jt.name
  AND e.job_title IS NOT NULL
  AND TRIM(e.job_title) != '';

COMMENT ON COLUMN employees.job_title IS 'Legacy free-text field. Kept for backward compatibility. New employees should use job_title_id.';

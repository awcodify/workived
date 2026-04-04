-- 000053_migrate_existing_job_titles.down.sql
-- Revert job_title_id links to NULL (data still in job_title text field)
UPDATE employees SET job_title_id = NULL WHERE job_title_id IS NOT NULL;

-- Delete all job_title records created by migration
-- (We can't reliably distinguish migration-created from manually-created, so delete all)
TRUNCATE TABLE job_titles;

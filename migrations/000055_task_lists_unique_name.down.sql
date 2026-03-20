-- Remove unique constraint
ALTER TABLE task_lists
DROP CONSTRAINT task_lists_org_name_unique;

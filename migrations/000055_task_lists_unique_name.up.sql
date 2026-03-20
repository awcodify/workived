-- Add unique constraint to prevent duplicate task list names per org
ALTER TABLE task_lists
ADD CONSTRAINT task_lists_org_name_unique UNIQUE (organisation_id, name);

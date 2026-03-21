ALTER TABLE task_lists 
ADD COLUMN is_final_state BOOLEAN NOT NULL DEFAULT FALSE;

-- Set the "Done" list as final state by default
UPDATE task_lists 
SET is_final_state = TRUE 
WHERE name = 'Done';

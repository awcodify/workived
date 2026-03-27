-- Backfill completed_at for tasks in final-state lists that were never auto-completed
-- This fixes tasks that were moved to Done before is_final_state was available
UPDATE tasks t
SET completed_at = t.updated_at
FROM task_lists tl
WHERE t.task_list_id = tl.id
  AND t.organisation_id = tl.organisation_id
  AND tl.is_final_state = TRUE
  AND t.completed_at IS NULL;

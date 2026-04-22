-- This migration is not reversible as we don't know which employees
-- had NULL work_schedule_id before the migration.
-- Manual intervention would be required to revert this change.

-- No-op down migration
SELECT 1;

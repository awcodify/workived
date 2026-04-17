ALTER TABLE attendance_records
    DROP COLUMN IF EXISTS is_leaving_early,
    DROP COLUMN IF EXISTS is_overtime;

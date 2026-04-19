-- 000067_attendance_correction_cancelled_status.up.sql

ALTER TABLE attendance_corrections
    DROP CONSTRAINT attendance_corrections_status_check,
    ADD CONSTRAINT attendance_corrections_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

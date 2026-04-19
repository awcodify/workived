-- 000067_attendance_correction_cancelled_status.down.sql

-- Nullify cancelled rows before removing the status so the constraint doesn't fail
UPDATE attendance_corrections SET status = 'pending' WHERE status = 'cancelled';

ALTER TABLE attendance_corrections
    DROP CONSTRAINT attendance_corrections_status_check,
    ADD CONSTRAINT attendance_corrections_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'));

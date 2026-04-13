-- 000057_remove_claims_weight.up.sql
-- Remove claims_weight from scorecard_config.
-- Claims is a finance/reimbursement process, not a performance factor.
-- Redistribute the 15 points to attendance (+5 → 30) and tasks (+10 → 35).

ALTER TABLE scorecard_config
    DROP CONSTRAINT IF EXISTS chk_weights_sum,
    DROP CONSTRAINT IF EXISTS chk_weights_positive;

ALTER TABLE scorecard_config
    DROP COLUMN claims_weight;

ALTER TABLE scorecard_config
    ALTER COLUMN attendance_weight SET DEFAULT 30,
    ALTER COLUMN tasks_weight SET DEFAULT 35;

ALTER TABLE scorecard_config
    ADD CONSTRAINT chk_weights_sum CHECK (
        attendance_weight + punctuality_weight + leave_weight + tasks_weight = 100
    ),
    ADD CONSTRAINT chk_weights_positive CHECK (
        attendance_weight >= 0 AND punctuality_weight >= 0 AND
        leave_weight >= 0 AND tasks_weight >= 0
    );

-- Fix existing rows that were summing to 100 with claims_weight included
-- New distribution: att=30, pun=20, lev=15, tsk=35
UPDATE scorecard_config
SET attendance_weight = 30,
    punctuality_weight = 20,
    leave_weight = 15,
    tasks_weight = 35;

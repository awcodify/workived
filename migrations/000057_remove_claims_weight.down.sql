-- 000057_remove_claims_weight.down.sql

ALTER TABLE scorecard_config
    DROP CONSTRAINT IF EXISTS chk_weights_sum,
    DROP CONSTRAINT IF EXISTS chk_weights_positive;

ALTER TABLE scorecard_config
    ALTER COLUMN attendance_weight SET DEFAULT 25,
    ALTER COLUMN tasks_weight SET DEFAULT 25,
    ADD COLUMN claims_weight SMALLINT NOT NULL DEFAULT 15;

ALTER TABLE scorecard_config
    ADD CONSTRAINT chk_weights_sum CHECK (
        attendance_weight + punctuality_weight + leave_weight + tasks_weight + claims_weight = 100
    ),
    ADD CONSTRAINT chk_weights_positive CHECK (
        attendance_weight >= 0 AND punctuality_weight >= 0 AND
        leave_weight >= 0 AND tasks_weight >= 0 AND claims_weight >= 0
    );

UPDATE scorecard_config
SET attendance_weight = 25,
    punctuality_weight = 20,
    leave_weight = 15,
    tasks_weight = 25,
    claims_weight = 15;

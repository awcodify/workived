-- 000056_create_scorecard_config.up.sql
-- Per-org configurable scoring formula for employee performance scorecards.

CREATE TABLE scorecard_config (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

    -- Weights (must sum to 100)
    attendance_weight   SMALLINT NOT NULL DEFAULT 25,
    punctuality_weight  SMALLINT NOT NULL DEFAULT 20,
    leave_weight        SMALLINT NOT NULL DEFAULT 15,
    tasks_weight        SMALLINT NOT NULL DEFAULT 25,
    claims_weight       SMALLINT NOT NULL DEFAULT 15,

    -- Grade thresholds (A >= grade_a_min, B >= grade_b_min, C >= grade_c_min, D < grade_c_min)
    grade_a_min         SMALLINT NOT NULL DEFAULT 90,
    grade_b_min         SMALLINT NOT NULL DEFAULT 75,
    grade_c_min         SMALLINT NOT NULL DEFAULT 60,

    -- Flag thresholds
    late_flag_threshold  SMALLINT NOT NULL DEFAULT 3,
    leave_warning_pct    SMALLINT NOT NULL DEFAULT 90,
    task_concern_pct     SMALLINT NOT NULL DEFAULT 60,
    score_drop_threshold SMALLINT NOT NULL DEFAULT 10,

    -- Minimum working days before showing a score
    min_working_days    SMALLINT NOT NULL DEFAULT 5,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_scorecard_config_org UNIQUE (organisation_id),
    CONSTRAINT chk_weights_positive CHECK (
        attendance_weight >= 0 AND punctuality_weight >= 0 AND
        leave_weight >= 0 AND tasks_weight >= 0 AND claims_weight >= 0
    ),
    CONSTRAINT chk_weights_sum CHECK (
        attendance_weight + punctuality_weight + leave_weight + tasks_weight + claims_weight = 100
    ),
    CONSTRAINT chk_grade_order CHECK (grade_a_min > grade_b_min AND grade_b_min > grade_c_min AND grade_c_min > 0),
    CONSTRAINT chk_thresholds_positive CHECK (
        late_flag_threshold > 0 AND leave_warning_pct > 0 AND
        task_concern_pct > 0 AND score_drop_threshold > 0 AND min_working_days > 0
    )
);

CREATE INDEX idx_scorecard_config_org ON scorecard_config(organisation_id);

CREATE TRIGGER set_scorecard_config_updated_at
    BEFORE UPDATE ON scorecard_config
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

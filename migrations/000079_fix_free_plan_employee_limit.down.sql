-- Revert default back to 25 (original incorrect value).
-- Does NOT revert the backfilled rows — rolling back data is destructive and
-- the 25→15 change is a correctness fix, not a feature flag.

ALTER TABLE organisations
    ALTER COLUMN plan_employee_limit SET DEFAULT 25;

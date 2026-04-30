-- Fix free plan employee limit: default was incorrectly set to 25, should be 15.
-- Backfill existing free-plan orgs that still have the old default of 25.

ALTER TABLE organisations
    ALTER COLUMN plan_employee_limit SET DEFAULT 15;

UPDATE organisations
SET plan_employee_limit = 15
WHERE plan = 'free'
  AND plan_employee_limit = 25;

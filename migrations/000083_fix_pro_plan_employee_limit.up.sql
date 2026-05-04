-- 000083_fix_pro_plan_employee_limit.up.sql
-- Backfill: clear employee limit for orgs that already have an active pro license.
-- Going forward, plan sync is handled in application code (admin service), not via trigger.

UPDATE organisations
SET plan_employee_limit = NULL
WHERE plan = 'pro';

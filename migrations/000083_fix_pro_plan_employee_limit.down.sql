-- 000083_fix_pro_plan_employee_limit.down.sql
-- Cannot safely restore individual limits — set all pro orgs back to default free limit.
-- Manual review required after rollback.

UPDATE organisations
SET plan_employee_limit = 15
WHERE plan = 'pro';

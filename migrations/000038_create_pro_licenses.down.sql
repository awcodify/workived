-- 000038_create_pro_licenses.down.sql
DROP TRIGGER IF EXISTS trigger_sync_org_plan ON pro_licenses;
DROP FUNCTION IF EXISTS sync_org_plan_from_license();
DROP TABLE IF EXISTS pro_licenses;

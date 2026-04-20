-- Remove staff admin audit tracking from pro_licenses

DROP INDEX IF EXISTS idx_pro_licenses_staff_admin;

ALTER TABLE pro_licenses
DROP COLUMN IF EXISTS created_by_staff_admin_id;

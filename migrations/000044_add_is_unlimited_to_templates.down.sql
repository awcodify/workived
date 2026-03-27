-- 000044_add_is_unlimited_to_templates.down.sql
ALTER TABLE leave_policy_templates DROP COLUMN IF EXISTS is_unlimited;

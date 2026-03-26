-- 000039_sprint20_leave_prorate_daycount_holidays.down.sql

DROP INDEX IF EXISTS idx_holidays_org;
ALTER TABLE public_holidays DROP COLUMN IF EXISTS is_custom;
ALTER TABLE public_holidays DROP COLUMN IF EXISTS organisation_id;
ALTER TABLE leave_policy_templates DROP COLUMN IF EXISTS day_count_type;
ALTER TABLE leave_policies DROP COLUMN IF EXISTS day_count_type;
ALTER TABLE leave_policies DROP COLUMN IF EXISTS prorate_first_year;

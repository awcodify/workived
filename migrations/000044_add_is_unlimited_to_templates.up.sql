-- 000044_add_is_unlimited_to_templates.up.sql
-- Add is_unlimited flag to leave_policy_templates so sick leave imports correctly

ALTER TABLE leave_policy_templates ADD COLUMN is_unlimited BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark templates with 365 days as unlimited (sick leave)
UPDATE leave_policy_templates SET is_unlimited = TRUE WHERE entitled_days_per_year >= 365;
